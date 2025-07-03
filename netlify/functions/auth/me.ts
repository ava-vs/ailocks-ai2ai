import type { Handler } from '@netlify/functions';
import { db } from '../../../src/lib/db';
import { users } from '../../../src/lib/schema';
import { getAuthTokenFromHeaders, verifyToken } from '../../../src/lib/auth/auth-utils';
import { eq } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: headersBase, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { ...headersBase, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const token = getAuthTokenFromHeaders(event.headers as any);
    if (!token) {
      return { statusCode: 401, headers: { ...headersBase, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return { statusCode: 401, headers: { ...headersBase, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user) {
      return { statusCode: 404, headers: { ...headersBase, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'User not found' }) };
    }

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, email: user.email, name: user.name, country: user.country, city: user.city })
    };
  } catch (error) {
    console.error('Me error', error);
    return { statusCode: 500, headers: { ...headersBase, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}; 