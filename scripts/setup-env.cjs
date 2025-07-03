#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function setupEnvironment() {
  console.log('🔧 Setting up environment for database operations...');
  
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  // Check if .env file exists
  if (!fs.existsSync(envPath)) {
    console.log('📝 .env file not found. Creating from template...');
    
    if (fs.existsSync(envExamplePath)) {
      // Copy .env.example to .env
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      fs.writeFileSync(envPath, envExample);
      console.log('✅ Created .env file from .env.example');
    } else {
      // Create basic .env file
      const basicEnv = `# Database Configuration
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# AI API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=ant-your-anthropic-key
OPENROUTER_API_KEY=sk-or-your-openrouter-key

# Security
JWT_SECRET=your-jwt-secret-key
`;
      fs.writeFileSync(envPath, basicEnv);
      console.log('✅ Created basic .env file');
    }
    
    console.log('\n🔑 IMPORTANT: Update .env file with your actual credentials:');
    console.log('   1. Get DATABASE_URL from your Neon PostgreSQL dashboard');
    console.log('   2. Add your AI API keys');
    console.log('   3. Generate a secure JWT_SECRET');
    console.log('\n📖 See DATABASE_SETUP.md for detailed instructions');
    
    return false; // Credentials need to be updated
  }
  
  // Check if DATABASE_URL is configured
  require('dotenv').config();
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('postgresql://placeholder')) {
    console.log('⚠️  DATABASE_URL needs to be configured in .env file');
    console.log('   Current value:', process.env.DATABASE_URL || 'undefined');
    console.log('\n🔧 To fix:');
    console.log('   1. Open .env file');
    console.log('   2. Replace DATABASE_URL with your Neon PostgreSQL connection string');
    console.log('   3. Format: postgresql://username:password@host/database?sslmode=require');
    
    return false;
  }
  
  console.log('✅ Environment configuration looks good');
  console.log('📡 DATABASE_URL configured');
  
  return true;
}

// Run if called directly
if (require.main === module) {
  const isConfigured = setupEnvironment();
  process.exit(isConfigured ? 0 : 1);
}

module.exports = { setupEnvironment }; 