import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { AilockService } from '../../src/lib/ailock/core';
import { AilockMessageService } from '../../src/lib/ailock/message-service';

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

async function getUserAilockId(event: HandlerEvent): Promise<string | null> {
  const authHeader = event.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  try {
    const ailockService = new AilockService();
    const profile = await ailockService.getOrCreateAilock(payload.sub);
    return profile.id;
  } catch (error) {
    console.error('Failed to get user ailock ID:', error);
    return null;
  }
}

async function getInboxSummary(ailockId: string): Promise<{
  unreadCount: number;
  latestTimestamp: string | null;
  hasNewMessages: boolean;
}> {
  try {
    const messageService = new AilockMessageService();
    const unreadInteractions = await messageService.getInbox(ailockId, 'sent', 100);
    const allInteractions = await messageService.getInbox(ailockId, undefined, 10);
    
    return {
      unreadCount: unreadInteractions.length,
      latestTimestamp: allInteractions.length > 0 ? allInteractions[0].createdAt.toISOString() : null,
      hasNewMessages: unreadInteractions.length > 0
    };
  } catch (error) {
    console.error('Failed to get inbox summary:', error);
    return {
      unreadCount: 0,
      latestTimestamp: null,
      hasNewMessages: false
    };
  }
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
  }

  if (event.httpMethod !== 'GET') {
    return responseWithCORS(405, { error: 'Method not allowed' });
  }

  const userAilockId = await getUserAilockId(event);
  if (!userAilockId) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  try {
    const inboxSummary = await getInboxSummary(userAilockId);
    
    return responseWithCORS(200, {
      success: true,
      data: {
        ...inboxSummary,
        timestamp: new Date().toISOString(),
        ailockId: userAilockId
      }
    });
  } catch (error) {
    console.error('Failed to get inbox events:', error);
    return responseWithCORS(500, { 
      error: 'Failed to fetch inbox events',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 