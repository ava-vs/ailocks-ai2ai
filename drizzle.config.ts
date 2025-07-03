import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Validate DATABASE_URL
if (!process.env.DATABASE_URL && !process.env.NETLIFY_DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not found in environment variables');
  console.warn('   Create a .env file with your Neon PostgreSQL connection string');
  console.warn('   Format: DATABASE_URL=postgresql://username:password@host/database?sslmode=require');
}

export default {
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || 'postgresql://placeholder',
  },
  verbose: true,
  strict: true,
} satisfies Config;