import type { Handler, HandlerEvent } from '@netlify/functions';
import { AilockService } from '../../src/lib/ailock/core';
import { verifyToken, getAuthTokenFromHeaders } from '../../src/lib/auth/auth-utils';
import { withDbRetry } from '../../src/lib/db';
import { AilockMessageService } from '../../src/lib/ailock/message-service';

const responseWithCORS = (statusCode: number, body: any) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
  }
  if (event.httpMethod !== 'GET') {
    return responseWithCORS(405, { error: 'Method Not Allowed' });
  }

  // If no token in Authorization header, try to get from cookies
  let token = event.headers.authorization?.split(' ')[1];
  if (!token) {
    const cookieToken = getAuthTokenFromHeaders(event.headers);
    
    if (!cookieToken) {
      return responseWithCORS(401, { error: 'Unauthorized' });
    }
    
    token = cookieToken;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return responseWithCORS(403, { error: 'Forbidden: Invalid token' });
  }

  try {
    const messageService = new AilockMessageService();

    // Wrap the database-dependent call with our retry logic
    const stats = await withDbRetry(() =>
      messageService.getInteractionStats(payload.sub)
    );

    return responseWithCORS(200, {
      success: true,
      events: {
        unreadCount: stats.unread,
        // Add other event types here as needed in the future
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching Ailock events:', error);
    return responseWithCORS(500, {
      error: 'Failed to fetch events.',
      details: errorMessage,
    });
  }
}; 