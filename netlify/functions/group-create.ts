import type { Handler, HandlerEvent } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { GroupService } from '../../src/lib/ailock/group-service';
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
    const { name, type, description } = JSON.parse(event.body || '{}');
    if (!name || !type) {
      return responseWithCORS(400, { error: 'Group name and type are required' });
    }

    const groupService = new GroupService();
    const ailockService = new AilockService();

    // Wrap the database-dependent call with our retry logic
    const ailock = await withDbRetry(() =>
      ailockService.getFullAilockProfileByUserId(payload.sub)
    );

    const group = await withDbRetry(() =>
      groupService.createGroup(
        name,
        type,
        description,
        payload.sub,
        ailock.id
      )
    );

    return responseWithCORS(201, {
      success: true,
      message: 'Group created successfully.',
      group,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating group:', error);
    return responseWithCORS(500, {
      error: 'Failed to create group.',
      details: errorMessage,
    });
  }
};
