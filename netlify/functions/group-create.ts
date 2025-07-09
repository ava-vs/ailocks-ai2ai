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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
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
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { name, type, description, settings } = body;

    // Validate required fields
    if (!name || !type) {
      return responseWithCORS(400, { 
        error: 'Bad Request', 
        message: 'Name and type are required fields' 
      });
    }

    // Validate group type
    if (!['family', 'team', 'friends'].includes(type)) {
      return responseWithCORS(400, { 
        error: 'Bad Request', 
        message: 'Type must be one of: family, team, friends' 
      });
    }

    // Get user's Ailock ID
    const ailockService = new AilockService();
    const profile = await ailockService.getOrCreateAilock(payload.sub);
    
    if (!profile) {
      return responseWithCORS(404, { error: 'Ailock profile not found' });
    }

    // Create group
    const groupService = new GroupService();
    const group = await groupService.createGroup(
      name,
      type as 'family' | 'team' | 'friends',
      description || null,
      payload.sub,
      profile.id,
      settings || {}
    );

    return responseWithCORS(201, { 
      success: true, 
      group 
    });

  } catch (error: any) {
    console.error('Error creating group:', error);
    return responseWithCORS(500, { 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
};
