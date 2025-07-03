# Database Setup for Netlify + Neon PostgreSQL

## Step 1: Create Neon Database
1. Go to https://neon.tech
2. Create new project: "Ailocks AI2AI Network"
3. Copy the connection string from the dashboard
4. Format: `postgresql://username:password@host/database?sslmode=require`

## Step 2: Set Environment Variables in Netlify
1. Netlify Dashboard → Site Settings → Environment Variables
2. Add: `DATABASE_URL` = your_neon_connection_string
3. Also add your AI API keys:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENROUTER_API_KEY`

## Step 3: Initialize Database (Local Development)
```bash
# Generate migration files
npm run db:generate

# Push schema to Neon database
npm run db:push

# Test connection
npm run test:db
```

## Step 4: Initialize Database (Production)
1. Deploy to Netlify first
2. Test connection: `curl https://your-site.netlify.app/.netlify/functions/db-status`
3. Seed database: `curl -X POST https://your-site.netlify.app/.netlify/functions/seed-database`

## Step 5: Verify Setup
- Visit your site and check the Intent Panel
- Look for "Live Database" indicator (green dot)
- If you see "Demo Data" (yellow dot), check the browser console for errors

## Troubleshooting
- **Connection errors**: Check DATABASE_URL format and Neon database status
- **Migration errors**: Ensure Drizzle config uses `dialect: 'postgresql'`
- **API errors**: Check Netlify function logs in dashboard
- **No data**: Run the seed-database function to populate sample data

## Environment Variables Required
```env
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=ant-...
OPENROUTER_API_KEY=sk-or-...
JWT_SECRET=your-secret-key
```