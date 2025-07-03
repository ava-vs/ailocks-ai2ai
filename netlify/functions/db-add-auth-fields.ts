import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { sql } from 'drizzle-orm';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Adding auth fields to users table...');

    // Add authentication fields
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
    `);

    // Create indexes for performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_password_hash ON users(password_hash)
    `);

    console.log('Auth fields added successfully');

    // Verify the changes
    const columns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Authentication fields added to users table',
        columns: columns.rows
      })
    };
  } catch (error) {
    console.error('Error adding auth fields:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to add auth fields',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}; 