import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { GroupService } from '../../src/lib/ailock/group-service';

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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
    // Extract group ID from path
    const paths = event.path.split('/');
    const groupId = paths[paths.length - 1];
    
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
        // Get group details
        const group = await groupService.getGroup(groupId);
        if (!group) {
          return responseWithCORS(404, { error: 'Group not found' });
        }
        
        // Get members count
        const members = await groupService.getGroupMembers(groupId);
        
        // Get intents count
        const intents = await groupService.getGroupIntents(groupId);
        
        // Get user's role in the group
        const userMember = members.find(member => member.user_id === userId);
        
        return responseWithCORS(200, { 
          success: true, 
          group,
          meta: {
            membersCount: members.length,
            intentsCount: intents.length,
            userRole: userMember?.role || 'guest'
          }
        });
      }

      case 'PUT': {
        // Update group details
        const body = JSON.parse(event.body || '{}');
        const { name, description, settings } = body;
        
        // Check if user has permission to update group
        const canUpdate = await groupService.checkMemberPermission(
          groupId, 
          userId,
          ['owner', 'admin']
        );
        
        if (!canUpdate) {
          return responseWithCORS(403, { error: 'Permission denied' });
        }
        
        const updatedGroup = await groupService.updateGroup(
          groupId,
          userId,
          { name, description, settings }
        );
        
        return responseWithCORS(200, { success: true, group: updatedGroup });
      }

      case 'DELETE': {
        // Delete group
        const canDelete = await groupService.checkMemberPermission(
          groupId, 
          userId,
          ['owner']
        );
        
        if (!canDelete) {
          return responseWithCORS(403, { error: 'Permission denied' });
        }
        
        await groupService.deleteGroup(groupId, userId);
        return responseWithCORS(200, { success: true });
      }

      default:
        return responseWithCORS(405, { error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error handling group details:', error);
    return responseWithCORS(500, { 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
};
