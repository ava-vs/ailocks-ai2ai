import { chatService } from '../../src/lib/chat-service';

export default async (request: Request) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');

    if (sessionId) {
      // Get specific session history
      const session = await chatService.getSession(sessionId);
      
      if (!session) {
        return new Response(JSON.stringify({
          sessionId: sessionId,
          messages: [],
          mode: 'researcher', // Default values
          language: 'en',
          isActive: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(JSON.stringify({
        sessionId: session.id,
        messages: session.messages,
        mode: session.mode,
        language: session.language,
        isActive: session.isActive,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else if (userId) {
      // Get all sessions for a user
      const sessions = await chatService.getUserSessions(userId);
      
      return new Response(JSON.stringify({
        userId,
        sessions: sessions.map(session => ({
          id: session.id,
          mode: session.mode,
          language: session.language,
          messageCount: session.messages.length,
          lastMessage: session.messages[session.messages.length - 1]?.content || '',
          isActive: session.isActive,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }))
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Either sessionId or userId is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

  } catch (error) {
    console.error('Chat history error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to retrieve chat history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
