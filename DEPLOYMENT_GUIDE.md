# Ailocks Database Deployment Guide

## Step 1: Set Up Neon PostgreSQL Database

### Create Neon Database
1. Go to [https://neon.tech](https://neon.tech)
2. Sign up/login and create a new project
3. Name it: "Ailocks AI2AI Network"
4. Copy the connection string from the dashboard
5. Format should be: `postgresql://username:password@host/database?sslmode=require`

## Step 2: Configure Netlify Environment Variables

### Required Environment Variables
In Netlify Dashboard → Site Settings → Environment Variables, add:

```env
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=ant-your-anthropic-key
OPENROUTER_API_KEY=sk-or-your-openrouter-key
JWT_SECRET=your-jwt-secret-key
```

## Step 3: Apply Database Migrations

### Local Development
```bash
# Generate migration files (already done)
npm run db:generate

# Push schema to Neon database
npm run db:push

# Test connection
npm run test:db
```

### Production Deployment
The migrations will be automatically applied during the build process.

## Step 4: Initialize Database with Sample Data

### After Successful Deployment
1. **Test Database Connection:**
   ```bash
   curl https://ailocks.netlify.app/.netlify/functions/db-status
   ```

2. **Seed Database with Sample Data:**
   ```bash
   curl -X POST https://ailocks.netlify.app/.netlify/functions/seed-database
   ```

3. **Verify Intents API:**
   ```bash
   curl "https://ailocks.netlify.app/.netlify/functions/intents-list?userCountry=BR&userCity=Rio%20de%20Janeiro"
   ```

## Step 5: Verify Integration

### Check Data Source Indicators
- Visit your deployed site: https://ailocks.netlify.app
- Look at the Intent Panel (right sidebar)
- You should see:
  - **Green dot + "Live Database"** = Real data working ✅
  - **Blue dot + "Demo Data"** = Fallback to mock data ⚠️
  - **Yellow dot + "Offline Mode"** = API errors ❌

### Troubleshooting

#### If you see "Demo Data" instead of "Live Database":
1. Check browser console for API errors
2. Verify DATABASE_URL is set correctly in Netlify
3. Check Netlify function logs for database connection errors
4. Ensure Neon database is running and accessible

#### Common Issues:
- **Connection timeout**: Check Neon database status
- **Authentication failed**: Verify DATABASE_URL format and credentials
- **Tables don't exist**: Run `npm run db:push` to apply migrations
- **No data returned**: Run the seed-database function

## Step 6: Database Management Commands

### Available Scripts
```bash
# Local development
npm run db:generate    # Generate new migrations
npm run db:push       # Apply migrations to database
npm run db:studio     # Open Drizzle Studio (database GUI)
npm run db:reset      # Force reset database schema
npm run db:init       # Test database connection
npm run db:seed       # Seed with sample data

# Testing
npm run test:db       # Test database API endpoint
npm run test:intents  # Test intents API endpoint
```

## Expected Results

### Successful Setup Indicators:
1. ✅ Database connection successful
2. ✅ Tables created (users, intents, chat_sessions, smart_chains, chain_steps)
3. ✅ Sample data populated (5 users, 8+ intents)
4. ✅ API endpoints returning real data
5. ✅ Intent Panel showing "Live Database" indicator
6. ✅ Location-based intent filtering working
7. ✅ Graceful fallback to mock data if needed

### Database Schema Overview:
- **users**: User profiles with location and language preferences
- **intents**: Collaboration opportunities with location targeting
- **chat_sessions**: AI chat session management
- **smart_chains**: Complex multi-step project chains
- **chain_steps**: Individual steps within smart chains

The system is designed to work seamlessly with both real database data and mock data fallbacks, ensuring the UI never breaks even if the database is temporarily unavailable.