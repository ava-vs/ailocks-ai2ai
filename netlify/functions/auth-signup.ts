import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { users, ailocks, escrowUserLinks } from '../../src/lib/schema';
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

    // Create Ailock profile with retry mechanism
    let ailockProfile = null;
    attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        const ailockProfileData = {
          userId: inserted.id,
          name: 'Ailock',
          level: 1,
          xp: 0,
          skillPoints: 1,
          avatarPreset: 'default',
          velocity: 50,
          insight: 50,
          efficiency: 50,
          economy: 50,
          convenience: 50
        };

        [ailockProfile] = await db.insert(ailocks).values(ailockProfileData).returning();
        console.log('Auth signup: Ailock profile created', { id: ailockProfile.id, userId: ailockProfile.userId });

    // --- Escrow API user sync (English comments) ---
// helper to cache service JWT
let escrowAuthCache: { token: string; expiresAt: number } | null = null;

async function getEscrowAccessToken() {
  const now = Date.now();
  if (escrowAuthCache && escrowAuthCache.expiresAt > now + 60_000) {
    return escrowAuthCache.token;
  }
  const ESCROW_SYSTEM_EMAIL = process.env.ESCROW_SYSTEM_EMAIL;
  const ESCROW_SYSTEM_PASSWORD = process.env.ESCROW_SYSTEM_PASSWORD;
  const ESCROW_AUTH_URL = process.env.ESCROW_AUTH_URL || `${process.env.ESCROW_API_URL?.replace(/\/api$/, '')}/auth/login`;
  if (!ESCROW_SYSTEM_EMAIL || !ESCROW_SYSTEM_PASSWORD || !ESCROW_AUTH_URL) {
    console.warn('Escrow login skipped: missing service creds');
    return null;
  }
  const res = await fetch(ESCROW_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ESCROW_SYSTEM_EMAIL, password: ESCROW_SYSTEM_PASSWORD })
  });
  if (!res.ok) {
    console.warn('Escrow login failed', res.status);
    return null;
  }
  const json = await res.json();
  const token = json.access_token;
  if (token) {
    escrowAuthCache = { token, expiresAt: now + 14 * 60 * 1000 }; // 14 minutes cache
  }
  return token;
}
    try {
      const ESCROW_API_URL = process.env.ESCROW_API_URL;
      const ESCROW_API_KEY = process.env.ESCROW_API_KEY;
      if (!ESCROW_API_URL || !ESCROW_API_KEY) {
        console.warn('Escrow sync skipped: missing ESCROW_API_URL or ESCROW_API_KEY');
      } else {
        const accessToken = await getEscrowAccessToken();
        if (!accessToken) {
          console.warn('Escrow sync skipped: could not obtain JWT');
          throw new Error('no_token');
        }
        const headers = {
          'Content-Type': 'application/json',
          'X-API-Key': ESCROW_API_KEY,
          Authorization: `Bearer ${accessToken}`
        } as Record<string, string>;

        // 1) Try to find customer by email
        const lookupRes = await fetch(`${ESCROW_API_URL}/customers?email=${encodeURIComponent(email)}`, {
          method: 'GET',
          headers
        });
        if (!lookupRes.ok) {
          console.warn('Escrow user lookup failed', lookupRes.status);
        }
        const lookupJson = await lookupRes.json().catch(() => []);
        let escrowUserId: string | null = Array.isArray(lookupJson) && lookupJson.length > 0 ? lookupJson[0].id : null;

        // 2) Create customer if not found
        if (!escrowUserId) {
          const createRes = await fetch(`${ESCROW_API_URL}/customers`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, name })
          });
          if (createRes.ok) {
            const createdJson = await createRes.json();
            escrowUserId = createdJson.id;
            console.log('Escrow user created', { escrowUserId });
          } else {
            console.warn('Failed to create escrow user', createRes.status);
          }
        } else {
          console.log('Escrow user found', { escrowUserId });
        }

        // Persist mapping in escrow_user_links
        if (escrowUserId) {
          try {
            await db.insert(escrowUserLinks).values({ ai2aiUserId: inserted.id, escrowUserId }).onConflictDoNothing();
          } catch (mapErr) {
            console.warn('Failed to persist escrowUserLink', mapErr);
          }
        }
      }
    } catch (escrowErr) {
      console.error('Escrow sync error', escrowErr);
      // Do not interrupt registration flow on escrow failure
    }
        break;
      } catch (ailockError) {
        attempt++;
        console.log(`Auth signup: Ailock profile creation attempt ${attempt} failed`, ailockError);
        
        if (attempt >= maxAttempts) {
          console.error('Failed to create Ailock profile after multiple attempts', ailockError);
          // Do not interrupt registration process if profile creation fails
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      }
    }

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