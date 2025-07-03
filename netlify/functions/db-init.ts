import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { users, intents } from '../../src/lib/schema';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    console.log('🔄 Initializing database with sample data...');
    
    // Create a test user first
    const [testUser] = await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User',
      country: 'US',
      city: 'New York',
      timezone: 'America/New_York',
      languages: ['en']
    }).returning();

    console.log('✅ Test user created:', testUser.id);

    // Create a sample intent
    const [testIntent] = await db.insert(intents).values({
      userId: testUser.id,
      title: 'Test Intent - Database Connection',
      description: 'This is a test intent to verify database connectivity',
      category: 'testing',
      targetCountry: 'US',
      targetCity: 'New York',
      requiredSkills: ['database', 'testing'],
      budget: 100000, // $1000 in cents
      timeline: '1 week',
      priority: 'normal',
      status: 'active'
    }).returning();

    console.log('✅ Test intent created:', testIntent.id);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'success', 
        message: 'Database initialized successfully',
        data: {
          userId: testUser.id,
          intentId: testIntent.id
        },
        timestamp: new Date().toISOString() 
      })
    };
  } catch (error) {
    console.error('Database initialization error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'error', 
        message: (error as Error).message,
        timestamp: new Date().toISOString()
      })
    };
  }
};