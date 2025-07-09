import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { GroupService } from '../../src/lib/ailock/group-service';

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  if (event.httpMethod !== 'GET') {
    return responseWithCORS(405, { error: 'Method not allowed' });
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

  try {
    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const type = queryParams.type;
    
    // Get groups for user
    const groupService = new GroupService();
    const groups = await groupService.getUserGroups(payload.sub, type);

    return responseWithCORS(200, { 
      success: true, 
      groups 
    });
  } catch (error: any) {
    console.error('Error listing groups:', error);
    return responseWithCORS(500, { 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
};
