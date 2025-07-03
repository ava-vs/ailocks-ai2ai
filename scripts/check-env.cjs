#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

// Check if required environment variables are available
const requiredEnvVars = ['DATABASE_URL'];

console.log('🔍 Checking environment variables...');

let allPresent = true;
for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Present`);
  } else {
    console.log(`❌ ${envVar}: Missing`);
    allPresent = false;
  }
}

if (!allPresent) {
  console.log('\n❌ Missing required environment variables!');
  console.log('📝 Required variables:');
  console.log('   DATABASE_URL=postgresql://username:password@host/database?sslmode=require');
  console.log('\n🔧 Set these in:');
  console.log('   - Netlify Dashboard → Site Settings → Environment Variables');
  console.log('   - Local: .env file in project root');
  process.exit(1);
}

console.log('\n✅ All required environment variables are present');
process.exit(0); 
