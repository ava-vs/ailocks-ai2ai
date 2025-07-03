#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function applyMigrations() {
  console.log('🔄 Applying database migrations...');
  
  try {
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  DATABASE_URL not found. Skipping migrations in build.');
      console.log('   Migrations will be applied when DATABASE_URL is available.');
      return true;
    }
    
    console.log('📡 DATABASE_URL found, applying migrations...');
    
    // Check if migration files exist
    const migrationsDir = path.join(process.cwd(), 'drizzle');
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 No migrations directory found. Generating migrations...');
      execSync('npm run db:generate', { stdio: 'inherit' });
    }
    
    // Apply migrations
    console.log('🚀 Pushing schema to database...');
    execSync('npm run db:push', { stdio: 'inherit' });
    
    console.log('✅ Database migrations applied successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Verify DATABASE_URL is correct');
    console.log('   2. Check Neon database is accessible');
    console.log('   3. Ensure network connectivity');
    
    // Don't fail the build - just warn
    console.log('\n⚠️  Continuing build without migrations...');
    console.log('   Run migrations manually after deployment:');
    console.log('   curl -X POST https://your-site.netlify.app/.netlify/functions/db-init');
    
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  applyMigrations()
    .then(() => {
      console.log('🎉 Migration process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(0); // Don't fail build
    });
}

module.exports = { applyMigrations }; 