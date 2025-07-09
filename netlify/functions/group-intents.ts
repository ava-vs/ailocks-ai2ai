import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { GroupService } from '../../src/lib/ailock/group-service';

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
        // Get all intents in the group
        const intents = await groupService.getGroupIntents(groupId);
        return responseWithCORS(200, { success: true, intents });
      }

      case 'POST': {
        // Add an intent to the group
        const body = JSON.parse(event.body || '{}');
        const { intentId, permissions } = body;
        
        if (!intentId) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Intent ID is required' 
          });
        }
        
        // Check if user has permission to add intents
        const canAddIntents = await groupService.checkMemberPermission(
          groupId, 
          userId,
          ['owner', 'admin', 'member']
        );
        
        if (!canAddIntents) {
          return responseWithCORS(403, { error: 'Permission denied' });
        }
        
        const groupIntent = await groupService.addIntent(
          groupId,
          intentId,
          userId,
          permissions || {}
        );
        
        return responseWithCORS(201, { success: true, groupIntent });
      }

      case 'DELETE': {
        // Remove an intent from the group
        const intentId = event.queryStringParameters?.intentId;
        
        if (!intentId) {
          return responseWithCORS(400, { 
            error: 'Bad Request', 
            message: 'Intent ID is required' 
          });
        }
        
        // Get the group intent to check who added it
        const groupIntents = await groupService.getGroupIntents(groupId);
        const targetIntent = groupIntents.find(intent => intent.intent_id === intentId);
        
        if (!targetIntent) {
          return responseWithCORS(404, { error: 'Intent not found in group' });
        }
        
        // Check if user is the owner of the group, admin, or the one who added the intent
        const canRemoveIntent = 
          await groupService.checkMemberPermission(groupId, userId, ['owner', 'admin']) ||
          targetIntent.added_by === userId;
        
        if (!canRemoveIntent) {
          return responseWithCORS(403, { error: 'Permission denied' });
        }
        
        await groupService.removeIntent(groupId, intentId);
        return responseWithCORS(200, { success: true });
      }

      default:
        return responseWithCORS(405, { error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error handling group intents:', error);
    return responseWithCORS(500, { 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
};
