import type { Handler } from '@netlify/functions';
import { db, withDbRetry, refreshDbConnection } from '../../src/lib/db';
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
    // Wrap queries with retry logic to handle transient network errors
    const [userCount] = await withDbRetry(() => db.select({ count: count() }).from(users), 3, 300);
    const [intentCount] = await withDbRetry(() => db.select({ count: count() }).from(intents), 3, 300);

    // Get sample data to verify structure (non-critical)
    const sampleIntent = await withDbRetry(() => db.select().from(intents).limit(1), 2, 300).catch(() => []);
    const sampleUser = await withDbRetry(() => db.select().from(users).limit(1), 2, 300).catch(() => []);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'ok',
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