# Netlify Environment Variables Setup

## Required Environment Variables

To enable live AI functionality on Netlify, you need to set these environment variables in your Netlify dashboard:

### 1. Go to Netlify Dashboard
1. Visit https://app.netlify.com/sites/ailocks/settings/env-vars
2. Click "Add a variable" for each of the following:

### 2. Add AI API Keys

**OPENAI_API_KEY**
- Value: `sk-your-openai-api-key-here`
- Description: OpenAI API key for GPT models

**ANTHROPIC_API_KEY** 
- Value: `ant-your-anthropic-api-key-here`
- Description: Anthropic API key for Claude models

**OPENROUTER_API_KEY**
- Value: `sk-or-your-openrouter-api-key-here`
- Description: OpenRouter API key as fallback

**ELEVENLABS_API_KEY**
- Value: `your-elevenlabs-api-key-here`
- Description: ElevenLabs API key for voice agent functionality

**PUBLIC_AGENT_ID**
- Value: `your-actual-agent-id-here`
- Description: ElevenLabs Agent ID for voice agent configuration

### 3. Additional Required Variables

**JWT_SECRET**
- Value: `your-jwt-secret-key-here`
- Description: Secret key for JWT token signing

**DATABASE_URL**
- Value: `postgresql://username:password@host/database?sslmode=require`
- Description: Neon PostgreSQL connection string

### 4. Deploy Changes
After adding all environment variables:
1. Click "Save" 
2. Go to "Deploys" tab
3. Click "Trigger deploy" → "Deploy site"

### 5. Test AI Functionality
Once deployed:
1. Visit https://ailocks.netlify.app
2. Try sending a message in the chat
3. You should see real AI responses instead of mock responses

## Troubleshooting

If AI still doesn't work after setting environment variables:

1. **Check Netlify Function Logs:**
   - Go to Netlify Dashboard → Functions → chat-stream
   - Check the logs for any errors

2. **Verify Environment Variables:**
   - In Netlify Dashboard → Site Settings → Environment Variables
   - Ensure all keys are set correctly with no extra spaces

3. **Test API Keys Locally:**
   ```bash
   # Test OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_OPENAI_KEY"
   
   # Test Anthropic  
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: YOUR_ANTHROPIC_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
   ```

4. **Check Network Connectivity:**
   - Ensure your API keys have sufficient credits
   - Verify the keys haven't expired
   - Check if there are any rate limits being hit

## Expected Behavior

After proper setup:
- Chat responses should come from real AI models
- No more "*Note: This is a mock response*" messages
- Response quality should be much higher
- Streaming responses should work properly