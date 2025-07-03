import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { users } from '../../src/lib/schema';
import { hashPassword, createToken, setAuthCookie } from '../../src/lib/auth/auth-utils';
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
    console.log('Auth signup: received request');
    
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body required' })
      };
    }

    const { email, password, name, country = null, city = null } = JSON.parse(event.body);
    console.log('Auth signup: parsed data', { email, name, country, city });

    if (!email || !password || !name) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email, password and name are required' })
      };
    }

    // Check if email already exists with retry
    let existing: any[] = [];
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
        break;
      } catch (dbError) {
        attempt++;
        console.log(`Auth signup: DB check attempt ${attempt} failed`, dbError);
        
        if (attempt >= maxAttempts) {
          throw dbError;
        }
        
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      }
    }
    
    if (existing.length > 0) {
      return {
        statusCode: 409,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email already registered' })
      };
    }

    const passwordHash = await hashPassword(password);
    console.log('Auth signup: password hashed');

    // Insert user with retry
    let inserted: any = null;
    attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        [inserted] = await db
          .insert(users)
          .values({ email, name, country, city, passwordHash })
          .returning();
        break;
      } catch (dbError) {
        attempt++;
        console.log(`Auth signup: DB insert attempt ${attempt} failed`, dbError);
        
        if (attempt >= maxAttempts) {
          throw dbError;
        }
        
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      }
    }

    if (!inserted) {
      throw new Error('Failed to create user after retries');
    }

    console.log('Auth signup: user created', { id: inserted.id, email: inserted.email });

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