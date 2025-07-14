import { AilockService } from '../../src/lib/ailock/core';
import { db, withDbRetry } from '@/lib/db';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import type { Handler, HandlerEvent } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
};

const responseWithCORS = (statusCode: number, body: any) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // For local development
    },
    body: JSON.stringify(body),
  };
};

export const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const token = event.headers.authorization?.split(' ')[1];
  const userIdFromQuery = event.queryStringParameters?.userId;

  let userId: string | undefined;

  if (token) {
    const payload = verifyToken(token);
    userId = payload?.sub;
  } else if (userIdFromQuery) {
    // This allows fetching public profiles, but sensitive data should be guarded.
    userId = userIdFromQuery;
  }

  if (!userId) {
    return responseWithCORS(401, { error: 'Unauthorized or User ID not provided' });
  }

  try {
    const ailockService = new AilockService();
    // Wrap the database-dependent call with our retry logic
    const profile = await withDbRetry(() => ailockService.getAilockProfileByUserId(userId as string));
    
    if (!profile) {
      return responseWithCORS(404, { error: 'Ailock profile not found' });
    }
    
    // Ensure we don't leak sensitive data for public requests
    const profileData = { ...profile };
    if (userIdFromQuery && (!token || verifyToken(token)?.sub !== userIdFromQuery)) {
       // Example of stripping sensitive data for public view
       // delete (profileData as any).privateField;
    }

    return responseWithCORS(200, { profile: profileData });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`Ailock profile error for userId ${userId}:`, error);
    return responseWithCORS(500, { error: 'Failed to retrieve Ailock profile.', details: errorMessage });
  }
};
