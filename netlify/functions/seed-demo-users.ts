import { db } from '../../src/lib/db';
import { users } from '../../src/lib/schema';
import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
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
    console.log('🔄 Seeding demo users...');

    // Define demo users with fixed UUIDs that match the frontend
    const demoUsersData = [
      {
        id: '6f3f3134-dd24-4665-b6cd-f9caf57d859f', // Lirea's fixed UUID
        email: 'lirea.designer@example.com',
        name: 'Lirea',
        country: 'BR',
        city: 'Rio de Janeiro',
        timezone: 'America/Sao_Paulo',
        languages: ['pt', 'en']
      },
      {
        id: '6376f30a-1ee4-4aa9-bdde-dd9ac0be6f24', // Marco's fixed UUID
        email: 'marco.manager@fintechrio.com',
        name: 'Marco',
        country: 'BR',
        city: 'Rio de Janeiro',
        timezone: 'America/Sao_Paulo',
        languages: ['pt', 'en']
      }
    ];

    const results = [];

    // Use Drizzle's `onConflictDoUpdate` (upsert) to handle existing users atomically.
    for (const userData of demoUsersData) {
      try {
        const [result] = await db
          .insert(users)
          .values({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            country: userData.country,
            city: userData.city,
            timezone: userData.timezone,
            languages: userData.languages,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            // Keep the row keyed by e-mail unique, but NEVER touch the primary key `id` –
            // changing it would break existing foreign-key references (e.g. `intents.user_id`).
            target: users.email,
            // Only mutable, non-referenced columns are updated.
            set: {
              name: userData.name,
              country: userData.country,
              city: userData.city,
              timezone: userData.timezone,
              languages: userData.languages,
              updatedAt: new Date(),
            },
          })
          .returning();
        
        console.log(`✅ Upserted demo user: ${result.name} (${result.id})`);
        results.push({ action: 'upserted', user: result });

      } catch (userError) {
        console.error(`❌ Failed to upsert user ${userData.name}:`, userError);
        results.push({ action: 'failed', error: userError instanceof Error ? userError.message : 'Unknown error', userData });
      }
    }

    // Verify users exist
    const allUsers = await db.select().from(users);
    const demoUserIds = demoUsersData.map(u => u.id);
    const existingDemoUsers = allUsers.filter(u => demoUserIds.includes(u.id));

    console.log(`✅ Demo users seeded successfully. Found ${existingDemoUsers.length} demo users in database.`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Demo users seeded successfully',
        results,
        existingDemoUsers: existingDemoUsers.map(u => ({ id: u.id, name: u.name, email: u.email })),
        totalUsers: allUsers.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Demo user seeding failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to seed demo users',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};