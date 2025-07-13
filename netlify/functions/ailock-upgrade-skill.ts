import type { Handler, HandlerEvent } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { AilockService } from '../../src/lib/ailock/core';
import { withDbRetry } from '../../src/lib/db';

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
    const { skillId } = JSON.parse(event.body || '{}');
    if (!skillId) {
      return responseWithCORS(400, { error: 'Skill ID is required' });
    }

    const ailockService = new AilockService();
    // Wrap the database-dependent call with our retry logic
    const success = await withDbRetry(() =>
      ailockService.upgradeSkill(payload.sub, skillId)
    );

    if (success) {
      return responseWithCORS(200, {
        success: true,
        message: 'Skill upgraded successfully.',
      });
    } else {
      return responseWithCORS(400, {
        success: false,
        error: 'Skill upgrade failed. Not enough points or skill not unlockable.',
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error upgrading skill:', error);
    return responseWithCORS(500, {
      error: 'Failed to process skill upgrade.',
      details: errorMessage,
    });
  }
};
