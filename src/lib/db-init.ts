import { db } from './db';
import { users, intents } from './schema';
import { count, eq } from 'drizzle-orm';

export async function initializeDatabase() {
  try {
    // Test basic connection
    await db.select().from(users).limit(1);
    console.log('✅ Database connection successful');
    return { success: true, message: 'Database connected' };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return { 
      success: false, 
      message: 'Database connection failed', 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function checkDatabaseHealth() {
  try {
    // Get table counts
    const [userCount] = await db.select({ count: count() }).from(users);
    const [intentCount] = await db.select({ count: count() }).from(intents);
    
    // Get sample data to verify structure
    const sampleUser = await db.select().from(users).limit(1);
    const sampleIntent = await db.select().from(intents).limit(1);
    
    return {
      status: 'healthy',
      connection: 'active',
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
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      connection: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

export async function testDatabaseOperations() {
  try {
    // Test read operation
    await db.select().from(users).limit(1);
    
    // Test write operation (safe test)
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      country: 'US',
      city: 'Test City',
      timezone: 'America/New_York',
      languages: ['en']
    };
    
    const insertResult = await db.insert(users).values(testUser).returning();
    
    // Clean up test data
    if (insertResult.length > 0) {
      await db.delete(users).where(eq(users.id, insertResult[0].id));
    }
    
    return {
      success: true,
      operations: {
        read: 'success',
        write: 'success',
        delete: 'success'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}