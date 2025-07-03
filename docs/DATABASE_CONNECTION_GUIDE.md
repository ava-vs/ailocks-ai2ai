# Database Connection Setup Guide

## Issue: `npm run db:push` Failing

The database push command is failing because the `DATABASE_URL` environment variable is not configured. Here's how to fix it:

## Step 1: Create Neon PostgreSQL Database

1. **Go to [Neon.tech](https://neon.tech)**
2. **Sign up/Login** and create a new project
3. **Name**: "Ailocks AI2AI Network"
4. **Copy the connection string** from the dashboard
5. **Format**: `postgresql://username:password@host/database?sslmode=require`

## Step 2: Configure Local Environment

### Option A: Automatic Setup
```bash
# This will create .env file if it doesn't exist
npm run db:setup
```

### Option B: Manual Setup
1. **Create `.env` file** in project root:
```env
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=ant-your-anthropic-key
OPENROUTER_API_KEY=sk-or-your-openrouter-key
JWT_SECRET=your-jwt-secret-key
```

2. **Replace `DATABASE_URL`** with your actual Neon connection string

## Step 3: Test Database Connection

```bash
# Check environment setup
npm run check:env

# Generate migrations (if needed)
npm run db:generate

# Push schema to database
npm run db:push

# Test connection
npm run db:init
```

## Step 4: Seed Database (Optional)

```bash
# Add sample data for testing
npm run db:seed
```

## Step 5: Deploy to Netlify

### Set Environment Variables in Netlify
1. **Netlify Dashboard** → Site Settings → Environment Variables
2. **Add the same variables** from your `.env` file:
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENROUTER_API_KEY`
   - `JWT_SECRET`

### Deploy
```bash
# Deploy with database support
npm run build
```

## Troubleshooting

### Common Issues:

#### 1. "DATABASE_URL not found"
- **Solution**: Create `.env` file with your Neon connection string
- **Check**: Run `npm run check:env` to verify

#### 2. "Connection timeout"
- **Solution**: Verify Neon database is running
- **Check**: Test connection in Neon dashboard

#### 3. "Authentication failed"
- **Solution**: Double-check username/password in connection string
- **Format**: `postgresql://username:password@host/database?sslmode=require`

#### 4. "Tables don't exist"
- **Solution**: Run `npm run db:push` to create tables
- **Alternative**: Check if migrations were applied

### Verification Commands:

```bash
# Test local database connection
npm run test:db

# Test intents API
npm run test:intents

# Open database GUI
npm run db:studio
```

## Expected Results

### After Successful Setup:
1. ✅ `npm run db:push` completes without errors
2. ✅ Database tables created (users, intents, etc.)
3. ✅ API endpoints return real data
4. ✅ Intent Panel shows "Live Database" indicator
5. ✅ Location-based filtering works

### Database Schema Created:
- **users**: User profiles with location data
- **intents**: Collaboration opportunities
- **chat_sessions**: AI chat management
- **smart_chains**: Multi-step project chains
- **chain_steps**: Individual chain steps

## Next Steps

Once database is connected:
1. **Deploy to Netlify** with environment variables
2. **Test production APIs** 
3. **Seed production database** if needed
4. **Verify real-time intent matching**

The application is designed to work with both real database data and mock data fallbacks, ensuring a smooth user experience regardless of database status.