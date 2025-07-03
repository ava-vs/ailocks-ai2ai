import type { Handler } from '@netlify/functions';
import { db } from '../../../src/lib/db';
import { users } from '../../../src/lib/schema';
import { hashPassword, createToken, setAuthCookie } from '../../../src/lib/auth/auth-utils';
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

    const { email, password, name, country = null, city = null } = JSON.parse(event.body);

    if (!email || !password || !name) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email, password and name are required' })
      };
    }

    // Check if email already exists
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return {
        statusCode: 409,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email already registered' })
      };
    }

    const passwordHash = await hashPassword(password);

    const [inserted] = await db
      .insert(users)
      .values({ email, name, country, city, passwordHash })
      .returning();

    const token = createToken({ sub: inserted.id, email: inserted.email, name: inserted.name ?? '' });

    return {
      statusCode: 201,
      headers: {
        ...headersBase,
        'Content-Type': 'application/json',
        'Set-Cookie': setAuthCookie(token)
      },
      body: JSON.stringify({
        id: inserted.id,
        email: inserted.email,
        name: inserted.name,
        country: inserted.country,
        city: inserted.city
      })
    };
  } catch (error) {
    console.error('Sign-up error', error);
    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 