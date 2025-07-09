import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { GroupService } from '../../src/lib/ailock/group-service';
import { AilockService } from '../../src/lib/ailock/core';

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
  }

  // Verify authentication for all methods except accepting invites (which might be anonymous)
  let userId: string | null = null;
  let userAilockId: string | null = null;
  
  const authHeader = event.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      userId = payload.sub;
      // Get user's Ailock ID for methods that need it
      if (event.httpMethod !== 'GET') {
        const ailockService = new AilockService();
        const profile = await ailockService.getOrCreateAilock(userId);
        if (profile) {
          userAilockId = profile.id;
        }
      }
    }
  }
  
  // For all methods except GET /accept-invite/:token, require authentication
  const isAcceptInviteRequest = event.path.includes('/accept-invite/');
  if (!isAcceptInviteRequest && !userId) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  const groupService = new GroupService();

  try {
    // Handle specific invite operations
    if (isAcceptInviteRequest) {
      // Extract token from path
      const paths = event.path.split('/');
      const token = paths[paths.length - 1];
      
      if (!token || !userId || !userAilockId) {
        return responseWithCORS(400, { 
          error: 'Bad Request', 
          message: 'Token and authenticated user are required' 
        });
      }
      
      const group = await groupService.acceptInvite(token, userId, userAilockId);
      return responseWithCORS(200, { success: true, group });
    }
    
    // For other operations, extract group ID from path
    const paths = event.path.split('/');
    const groupId = paths[paths.length - 2];
    
    if (!groupId) {
      return responseWithCORS(400, { error: 'Group ID is required' });
    }

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET': {
        // Check if user is a member with appropriate permissions
        const isMember = await groupService.checkMemberPermission(
          groupId, 
          userId!,  // userId is not null here due to auth check above
          ['owner', 'admin']
        );
        
        if (!isMember) {
          return responseWithCORS(403, { error: 'Permission denied' });
        }
        
        // Get pending invites for the group
        const invites = await groupService.getPendingInvites(groupId);
        return responseWithCORS(200, { success: true, invites });
      }

      case 'POST': {
        // Create a new invite
        const body = JSON.parse(event.body || '{}');
        const { email, role, expiresInDays } = body;
        
        if (!email || !role) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Email and role are required' 
          });
        }
        
        // Validate role
        if (!['admin', 'member', 'guest'].includes(role)) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Invalid role specified' 
          });
        }
        
        // Check if user has permission to invite
        const canInvite = await groupService.checkMemberPermission(
          groupId, 
          userId!, // userId is not null here due to auth check above
          ['owner', 'admin']
        );
        
        if (!canInvite) {
          return responseWithCORS(403, { error: 'Permission denied' });
        }
        
        // Convert days to milliseconds
        const expiresIn = expiresInDays ? expiresInDays * 24 * 60 * 60 * 1000 : undefined;
        
        const invite = await groupService.createInvite(
          groupId,
          email,
          role as any,
          userId!,
          expiresIn
        );

        // TODO: Send email with invitation link (implement email service)
        
        return responseWithCORS(201, { success: true, invite });
      }

      case 'DELETE': {
        // Cancel an invite
        const inviteId = event.queryStringParameters?.id;
        
        if (!inviteId) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Invite ID is required' 
          });
        }
        
        // Check if user has permission
        const canManageInvites = await groupService.checkMemberPermission(
          groupId, 
          userId!, // userId is not null here due to auth check above
          ['owner', 'admin']
        );
        
        if (!canManageInvites) {
          return responseWithCORS(403, { error: 'Permission denied' });
        }
        
        await groupService.cancelInvite(inviteId);
        return responseWithCORS(200, { success: true });
      }

      default:
        return responseWithCORS(405, { error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error handling group invites:', error);
    return responseWithCORS(500, { 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
};
