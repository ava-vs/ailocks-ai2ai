import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { GroupService } from '../../src/lib/ailock/group-service';

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

  // Verify authentication
  const authHeader = event.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  const userId = payload.sub;
  const groupService = new GroupService();

  try {
    // Get group ID from path parameter
    const paths = event.path.split('/');
    const groupId = paths[paths.length - 2];
    
    if (!groupId) {
      return responseWithCORS(400, { error: 'Group ID is required' });
    }

    // Check if user is a member of the group
    const isMember = await groupService.checkMemberPermission(
      groupId, 
      userId, 
      ['owner', 'admin', 'member', 'guest']
    );
    
    if (!isMember) {
      return responseWithCORS(403, { error: 'Permission denied' });
    }

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'GET': {
        // Get members of the group
        const members = await groupService.getGroupMembers(groupId);
        return responseWithCORS(200, { success: true, members });
      }

      case 'POST': {
        // Add a new member to the group
        const body = JSON.parse(event.body || '{}');
        const { targetUserId, ailockId, role } = body;
        
        if (!targetUserId || !ailockId || !role) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Missing required fields' 
          });
        }
        
        // Validate role
        if (!['admin', 'member', 'guest'].includes(role)) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Invalid role specified' 
          });
        }
        
        // Check if inviter has permission
        const canInvite = await groupService.checkMemberPermission(
          groupId, 
          userId, 
          ['owner', 'admin']
        );
        
        if (!canInvite) {
          return responseWithCORS(403, { error: 'Permission denied' });
        }

        const member = await groupService.addMember(
          groupId,
          targetUserId,
          ailockId,
          role as any,
          userId,
          'pending'
        );

        return responseWithCORS(201, { success: true, member });
      }

      case 'PUT': {
        // Update member role
        const body = JSON.parse(event.body || '{}');
        const { targetUserId, role } = body;
        
        if (!targetUserId || !role) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Missing required fields' 
          });
        }
        
        // Validate role
        if (!['admin', 'member', 'guest'].includes(role)) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Invalid role specified' 
          });
        }
        
        const updatedMember = await groupService.updateMemberRole(
          groupId,
          targetUserId,
          role as any,
          userId
        );

        return responseWithCORS(200, { success: true, member: updatedMember });
      }

      case 'DELETE': {
        // Remove a member from the group
        const targetUserId = event.queryStringParameters?.userId;
        
        if (!targetUserId) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'User ID is required' 
          });
        }
        
        await groupService.removeMember(groupId, targetUserId, userId);
        
        return responseWithCORS(200, { success: true });
      }

      default:
        return responseWithCORS(405, { error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error handling group members:', error);
    return responseWithCORS(500, { 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
};
