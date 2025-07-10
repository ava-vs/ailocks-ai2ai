import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { Client } from 'pg';
import { db } from '../../src/lib/db';
import { notifications } from '../../src/lib/schema';
import { getAuthTokenFromHeaders, verifyToken } from '../../src/lib/auth/auth-utils';
import { and, eq, desc } from 'drizzle-orm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function response(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Auth token can be in headers (for direct API calls) or cookie (for browser calls)
  const token = event.headers.cookie?.match(/auth_token=([^;]+)/)?.[1] ?? getAuthTokenFromHeaders(event.headers);

  if (!token) {
    return response(401, { error: 'Unauthorized: Missing token' });
  }

  const user = verifyToken(token);
  if (!user || !user.sub) {
    return response(401, { error: 'Unauthorized: Invalid token' });
  }

  const userId = user.sub;
  const channel = `new_notification_${userId}`;
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    // Identifiers with hyphens (like UUIDs) must be double-quoted in LISTEN/UNLISTEN.
    await client.query(`LISTEN "${channel}"`);

    const notificationPayload = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 25000); // Netlify function timeout is ~28s, being safe.

      client.on('notification', (msg) => {
        clearTimeout(timeout);
        // We only care that *a* notification arrived. We'll fetch all unread.
        resolve(msg.payload ?? 'notification'); 
      });

      client.on('error', (err) => {
        console.error('Postgres client error:', err);
        clearTimeout(timeout);
        resolve(null);
      });
    });

    if (notificationPayload) {
      // A notification was received. Fetch all unread notifications for the user.
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
        .orderBy(desc(notifications.createdAt));
      
      return response(200, userNotifications);
    } else {
      // Timeout reached, no new notifications.
      return {
        statusCode: 204, // No Content
        headers: corsHeaders
      };
    }
  } catch (error) {
    console.error('Long-polling error:', error);
    return response(500, { error: 'Internal Server Error' });
  } finally {
    // Closing the connection is enough – the server automatically clears LISTEN registrations
    try {
      await client.end();
    } catch (err) {
      console.error('Error ending PG client:', err);
    }
  }
}; 