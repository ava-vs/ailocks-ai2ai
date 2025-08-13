import type { Handler } from '@netlify/functions';
import { getAuthTokenFromHeaders, verifyToken } from '../../src/lib/auth/auth-utils';
import { db } from '../../src/lib/db';
import { ailocks } from '../../src/lib/schema';
import { eq } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headersBase,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Authentication
    const token = getAuthTokenFromHeaders(event.headers);
    if (!token) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    // Get user's ailock or first available ailock
    const userAilocks = await db.select().from(ailocks).where(eq(ailocks.userId, payload.sub)).limit(1);
    
    if (userAilocks.length > 0) {
      return {
        statusCode: 200,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ailockId: userAilocks[0].id,
          name: userAilocks[0].name,
          source: 'user_ailock'
        })
      };
    }

    // If no user ailock, get any ailock for testing
    const anyAilock = await db.select().from(ailocks).limit(1);
    
    if (anyAilock.length > 0) {
      return {
        statusCode: 200,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ailockId: anyAilock[0].id,
          name: anyAilock[0].name,
          source: 'any_ailock'
        })
      };
    }

    return {
      statusCode: 404,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'No ailocks found in database' })
    };

  } catch (error) {
    console.error('Get ailock ID error:', error);
    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
