import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { users, escrowUserLinks } from '../../src/lib/schema';
import { verifyToken, getAuthTokenFromHeaders } from '../../src/lib/auth/auth-utils';
import { eq } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    console.log('Auth me: received request');
    
    const token = getAuthTokenFromHeaders(event.headers);

    if (!token) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No token provided' })
      };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    const userRes = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      country: users.country,
      city: users.city,
      escrow_user_id: escrowUserLinks.escrowUserId
    })
    .from(users)
    .leftJoin(escrowUserLinks, eq(users.id, escrowUserLinks.ai2aiUserId))
    .where(eq(users.id, payload.sub))
    .limit(1);
    if (userRes.length === 0) {
      return {
        statusCode: 404,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const user = userRes[0];
    console.log('Auth me: success', { id: user.id, email: user.email, escrow_user_id: user.escrow_user_id });

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        country: user.country,
        city: user.city,
        escrow_user_id: user.escrow_user_id
      })
    };
  } catch (error) {
    console.error('Me error', error);
    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};