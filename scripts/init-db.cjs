const { db } = require('../src/lib/db');
const { users, intents } = require('../src/lib/schema');
const { count } = require('drizzle-orm');

async function initializeDatabase() {
  console.log('🔄 Initializing database...');
  
  try {
    // Test basic connection
    console.log('📡 Testing database connection...');
    await db.select().from(users).limit(1);
    console.log('✅ Database connection successful');
    
    // Check if tables have data
    const [userCount] = await db.select({ count: count() }).from(users);
    const [intentCount] = await db.select({ count: count() }).from(intents);
    
    console.log(`📊 Current data: ${userCount.count} users, ${intentCount.count} intents`);
    
    // If no data exists, suggest seeding
    if (userCount.count === 0 && intentCount.count === 0) {
      console.log('💡 Database is empty. Run seed-database function to populate sample data.');
      console.log('   curl -X POST https://your-site.netlify.app/.netlify/functions/seed-database');
    }
    
    console.log('✅ Database initialization complete');
    return true;
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('🔧 Troubleshooting:');
    console.error('   1. Check DATABASE_URL environment variable');
    console.error('   2. Verify Neon database is running');
    console.error('   3. Run: npm run db:push to apply migrations');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase }; 