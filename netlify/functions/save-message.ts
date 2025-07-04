import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { chatService } from '../../src/lib/chat-service';
import type { ChatMessage } from '../../src/lib/types';

// Utility to simplify CORS responses
function responseWithCORS(status: number, body: any): HandlerResponse {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
}

// POST /save-message
// Body: { sessionId: string; message: ChatMessageLike }
// ChatMessageLike mirrors ChatMessage structure but timestamp may be string.
export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS pre-flight
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, { message: 'Pre-flight OK' });
  }

  if (event.httpMethod !== 'POST') {
    return responseWithCORS(405, { error: 'Method Not Allowed' });
  }

  try {
    if (!event.body) {
      return responseWithCORS(400, { error: 'Request body is required' });
    }

    const { sessionId, message } = JSON.parse(event.body);

    if (!sessionId || !message) {
      return responseWithCORS(400, { error: 'sessionId and message are required' });
    }

    // Normalise incoming message into ChatMessage shape
    const chatMessage: ChatMessage = {
      id: message.id || `msg-${Date.now()}`,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || ''),
      timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
      mode: message.mode || 'text',
      metadata: message.metadata || {}
    };

    await chatService.saveMessage(sessionId, chatMessage);

    return responseWithCORS(200, { status: 'saved' });
  } catch (error: any) {
    console.error('❌ save-message error:', error);
    return responseWithCORS(500, { error: error?.message || 'Internal Error' });
  }
}; 