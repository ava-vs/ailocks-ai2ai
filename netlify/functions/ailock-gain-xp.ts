import type { Handler, HandlerEvent } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { AilockService } from '../../src/lib/ailock/core';
import { withDbRetry } from '../../src/lib/db';
import type { XpEventType } from '../../src/lib/ailock/shared';

const responseWithCORS = (statusCode: number, body: any) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
  }
  if (event.httpMethod !== 'POST') {
    return responseWithCORS(405, { error: 'Method Not Allowed' });
  }

  const token = event.headers.authorization?.split(' ')[1];
  if (!token) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return responseWithCORS(403, { error: 'Forbidden: Invalid token' });
  }

  try {
    const { eventType, context } = JSON.parse(event.body || '{}');
    if (!eventType) {
      return responseWithCORS(400, { error: 'Event type is required' });
    }

    const ailockService = new AilockService();

    // Get profile by userId to know the exact ailockId
    const profile = await withDbRetry(() =>
      ailockService.getAilockProfileByUserId(payload.sub)
    );
    if (!profile) {
      return responseWithCORS(404, { error: 'Ailock profile not found for user.' });
    }

    // Wrap the database-dependent call with our retry logic
    const result = await withDbRetry(() =>
      ailockService.gainXp(profile.id, eventType as XpEventType, context)
    );

    // Return the result as is
    return responseWithCORS(200, {
      ...result,
      message: 'XP processed successfully.'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error gaining XP:', error);
    return responseWithCORS(500, {
      error: 'Failed to process XP event.',
      details: errorMessage,
    });
  }
};
