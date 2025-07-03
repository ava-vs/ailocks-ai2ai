import type { Handler } from '@netlify/functions';
import { db } from '../../../src/lib/db';
import { users } from '../../../src/lib/schema';
import { comparePassword, createToken, setAuthCookie } from '../../../src/lib/auth/auth-utils';
import { eq } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headersBase,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body required' })
      };
    }

    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email and password required' })
      };
    }

    const userRes = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (userRes.length === 0 || !userRes[0].passwordHash) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    const user = userRes[0];
    const valid = await comparePassword(password, user.passwordHash as string);
    if (!valid) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Update last_login
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

    const token = createToken({ sub: user.id, email: user.email, name: user.name ?? '' });

    return {
      statusCode: 200,
      headers: {
        ...headersBase,
        'Content-Type': 'application/json',
        'Set-Cookie': setAuthCookie(token)
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        country: user.country,
        city: user.city
      })
    };
  } catch (error) {
    console.error('Login error', error);
    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 