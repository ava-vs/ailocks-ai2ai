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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  },
  body: JSON.stringify(body),
});

async function handlePost(event: HandlerEvent, payload: any) {
  const { groupId, userId, role } = JSON.parse(event.body || '{}');
  if (!groupId || !userId || !role) {
    return responseWithCORS(400, { error: 'groupId, userId, and role are required' });
  }

  const groupService = new GroupService();
  const ailockService = new AilockService();

  const hasPermission = await withDbRetry(() =>
    groupService.checkMemberPermission(groupId, payload.sub, ['owner', 'admin'])
  );

  if (!hasPermission) {
    return responseWithCORS(403, { error: 'Forbidden: You do not have permission to invite users to this group.' });
  }

  const targetAilock = await withDbRetry(() =>
    ailockService.getFullAilockProfileByUserId(userId)
  );

  const newMember = await withDbRetry(() =>
    groupService.addMember(groupId, userId, targetAilock.id, role, payload.sub)
  );

  return responseWithCORS(201, { success: true, member: newMember });
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
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
    switch (event.httpMethod) {
      case 'POST':
        return await handlePost(event, payload);
      // Implement GET, DELETE handlers as needed
      default:
        return responseWithCORS(405, { error: `Method ${event.httpMethod} Not Allowed` });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Group invites error:', error);
    return responseWithCORS(500, {
      error: 'Failed to process group invite request.',
      details: errorMessage,
    });
  }
};
