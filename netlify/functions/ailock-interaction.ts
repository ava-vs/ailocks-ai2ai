import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { ailockMessageService } from '../../src/lib/ailock/message-service';
import { verifyToken, getAuthTokenFromHeaders } from '../../src/lib/auth/auth-utils';
import { ailockService } from '../../src/lib/ailock/core';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
};

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
};

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(body)
  };
}

async function getUserAilockId(event: HandlerEvent): Promise<string | null> {
  let token: string | null = null;

  const authHeader = event.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Try cookie
    token = getAuthTokenFromHeaders(event.headers as any);
  }

  if (!token) {
    return null;
  }
  
  const payload = verifyToken(token);
  
  if (!payload) {
    return null;
  }
  
  try {
    const profile = await ailockService.getOrCreateAilock(payload.sub);
    return profile.id;
  } catch (error) {
    console.error('Failed to get user ailock:', error);
    return null;
  }
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const method = event.httpMethod;
    
    // Проверяем параметр action для дополнительных операций
    const action = event.queryStringParameters?.action;
    
    switch (method) {
      case 'POST':
        return await sendInteraction(event);
      case 'GET':
        if (action === 'search') {
          return await searchAilocks(event);
        }
        return await getInbox(event);
      case 'PUT':
        return await markAsRead(event);
      case 'PATCH':
        return await respondToMessage(event);
      default:
        return responseWithCORS(405, { error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Ailock interaction error:', error);
    return responseWithCORS(500, {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * POST - Отправка сообщения между Айлоками
 */
async function sendInteraction(event: HandlerEvent): Promise<HandlerResponse> {
  const userAilockId = await getUserAilockId(event);
  if (!userAilockId) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  if (!event.body) {
    return responseWithCORS(400, { error: 'Request body is required' });
  }

  const { toAilockId, message, type, intentId, sessionId } = JSON.parse(event.body);

  if (!toAilockId || !message || !type) {
    return responseWithCORS(400, { 
      error: 'Missing required fields: toAilockId, message, type' 
    });
  }

  try {
    const context = {
      intent: intentId ? { id: intentId, sessionId } : undefined
    };

    const interaction = await ailockMessageService.sendInteraction(
      userAilockId,
      toAilockId,
      message,
      type,
      context
    );

    return responseWithCORS(201, {
      success: true,
      interaction,
      estimatedResponseTime: '2-4 hours'
    });
  } catch (error) {
    return responseWithCORS(400, {
      error: 'Failed to send interaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET - Получение входящих сообщений
 */
async function getInbox(event: HandlerEvent): Promise<HandlerResponse> {
  const userAilockId = await getUserAilockId(event);
  if (!userAilockId) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  const params = event.queryStringParameters || {};
  const status = params.status as any;
  const limit = parseInt(params.limit || '20', 10);
  const offset = parseInt(params.offset || '0', 10);

  try {
    const interactions = await ailockMessageService.getInbox(
      userAilockId,
      status,
      limit,
      offset
    );

    const unreadCount = status !== 'sent' ? 
      (await ailockMessageService.getInbox(userAilockId, 'sent')).length : 
      interactions.length;

    return responseWithCORS(200, {
      interactions,
      unreadCount,
      hasMore: interactions.length === limit,
      nextCursor: interactions.length === limit ? (offset + limit).toString() : null
    });
  } catch (error) {
    return responseWithCORS(500, {
      error: 'Failed to get inbox',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * PUT - Пометить сообщение как прочитанное
 */
async function markAsRead(event: HandlerEvent): Promise<HandlerResponse> {
  const userAilockId = await getUserAilockId(event);
  if (!userAilockId) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  if (!event.body) {
    return responseWithCORS(400, { error: 'Request body is required' });
  }

  const { interactionId } = JSON.parse(event.body);

  if (!interactionId) {
    return responseWithCORS(400, { error: 'Missing interactionId' });
  }

  try {
    await ailockMessageService.markAsRead(interactionId, userAilockId);
    return responseWithCORS(200, { success: true });
  } catch (error) {
    return responseWithCORS(400, {
      error: 'Failed to mark as read',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET - Поиск Айлоков по имени
 */
async function searchAilocks(event: HandlerEvent): Promise<HandlerResponse> {
  const params = event.queryStringParameters || {};
  const name = params.name;

  if (!name) {
    return responseWithCORS(400, { error: 'Missing search parameter: name' });
  }

  try {
    const ailocks = await ailockMessageService.searchAilocksByName(name);
    
    return responseWithCORS(200, {
      ailocks: ailocks.map(ailock => ({
        id: ailock.id,
        name: ailock.name,
        level: ailock.level,
        skills: ailock.skills,
        city: ailock.city,
        country: ailock.country,
        isActive: ailock.isActive
      }))
    });
  } catch (error) {
    return responseWithCORS(500, {
      error: 'Failed to search Ailocks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * PATCH - Ответить на сообщение
 */
async function respondToMessage(event: HandlerEvent): Promise<HandlerResponse> {
  const userAilockId = await getUserAilockId(event);
  if (!userAilockId) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  if (!event.body) {
    return responseWithCORS(400, { error: 'Request body is required' });
  }

  const { originalInteractionId, responseContent } = JSON.parse(event.body);

  if (!originalInteractionId || !responseContent) {
    return responseWithCORS(400, { 
      error: 'Missing required fields: originalInteractionId, responseContent' 
    });
  }

  try {
    const response = await ailockMessageService.respondToInteraction(
      originalInteractionId,
      userAilockId,
      responseContent
    );

    return responseWithCORS(200, {
      success: true,
      response
    });
  } catch (error) {
    return responseWithCORS(400, {
      error: 'Failed to respond to message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 