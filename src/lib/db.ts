import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

function createDb() {
  const sql = neon(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL!);
  return drizzle(sql, { schema });
}

// Exported as mutable binding so other modules observe updates after refresh
export let db = createDb();

/**
 * Explicitly re-creates the Neon HTTP client and Drizzle instance.
 * Use this when a transient network error (e.g. `fetch failed`) occurs so
 * subsequent queries get a fresh connection. The function returns the new
 * db instance for convenience.
 */
export function refreshDbConnection() {
  db = createDb();
  return db;
}

/**
 * Executes a database operation with automatic retry on transient network errors.
 * Refreshes the DB connection on 'fetch failed' errors and retries up to maxAttempts times.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 2,
  backoffMs: number = 200
): Promise<T> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      return await operation();
    } catch (error: any) {
      attempts++;
      console.warn(`DB operation attempt ${attempts} failed:`, error.message);
      
      // Check if it's a network error we want to retry
      if (error.toString().includes('fetch failed') && attempts < maxAttempts) {
        console.log('Refreshing DB connection and retrying...');
        refreshDbConnection();
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        // Either not a retryable error, or we've exhausted our attempts
        throw error;
      }
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('Failed to execute DB operation after all retry attempts');
}

export type User = typeof schema.users.$inferSelect;
export type NewUser = typeof schema.users.$inferInsert;
export type ChatSession = typeof schema.chatSessions.$inferSelect;
export type NewChatSession = typeof schema.chatSessions.$inferInsert;
export type Intent = typeof schema.intents.$inferSelect;
export type NewIntent = typeof schema.intents.$inferInsert;
export type SmartChain = typeof schema.smartChains.$inferSelect;
export type NewSmartChain = typeof schema.smartChains.$inferInsert;