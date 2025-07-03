import type { Handler } from '@netlify/functions';
import { ChatService } from '../../src/lib/chat-service';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = event.body;
    if (!body) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const { mode, language = 'en', userId } = JSON.parse(body);

    if (!mode) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Mode is required' })
      };
    }

    if (!userId) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    // Check for invalid userId values
    if (userId === 'loading' || userId === 'anonymous') {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ 
          error: 'Invalid user ID', 
          message: 'Please wait for user data to load before creating session',
          retry: true
        })
      };
    }

    // Create session in database
    const chatService = new ChatService();
    const sessionId = await chatService.createSession(userId, mode, language);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ 
        sessionId,
        message: 'Session created successfully'
      })
    };

  } catch (error) {
    console.error('Session creation error:', error);
    
    // Check if it's a user validation error
    if (error instanceof Error && error.message.includes('Invalid userId')) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ 
          error: 'Invalid user data',
          message: 'Please wait for user data to load and try again',
          retry: true
        })
      };
    }
    
    // Fallback: create a simple session ID without database storage
    const fallbackSessionId = `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ 
        sessionId: fallbackSessionId,
        fallback: true,
        warning: 'Session created without database persistence',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};