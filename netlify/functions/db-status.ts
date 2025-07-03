import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { intents, users } from '../../src/lib/schema';
import { count } from 'drizzle-orm';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Test database connection and get counts
    const [userCount] = await db.select({ count: count() }).from(users);
    const [intentCount] = await db.select({ count: count() }).from(intents);
    
    // Get sample data to verify structure
    const sampleIntent = await db.select().from(intents).limit(1);
    const sampleUser = await db.select().from(users).limit(1);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        database: 'connected',
        tables: {
          users: {
            count: userCount.count,
            hasData: userCount.count > 0,
            sample: sampleUser.length > 0 ? sampleUser[0] : null
          },
          intents: {
            count: intentCount.count,
            hasData: intentCount.count > 0,
            sample: sampleIntent.length > 0 ? sampleIntent[0] : null
          }
        },
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      })
    };
  } catch (error) {
    console.error('Database status error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};