import type { Handler } from '@netlify/functions';
import { deepResearchService } from '../../src/lib/deep-research-service';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'Preflight request processed' })
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const healthStatus = await deepResearchService.healthCheck();
    
    const envChecks = {
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
      openrouterConfigured: !!process.env.OPENROUTER_API_KEY
    };

    const overallStatus = 
      healthStatus.status === 'healthy' && 
      (envChecks.openaiConfigured || envChecks.anthropicConfigured || envChecks.openrouterConfigured);

    return {
      statusCode: overallStatus ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      },
      body: JSON.stringify({
        status: overallStatus ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        components: {
          deepResearchService: healthStatus,
          environment: envChecks
        },
        features: {
          academicResearch: healthStatus.services.semanticScholar,
          aiAnalysis: envChecks.openaiConfigured || envChecks.anthropicConfigured || envChecks.openrouterConfigured
        }
      }, null, 2)
    };

  } catch (error: any) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      },
      body: JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message || 'Health check failed'
      }, null, 2)
    };
  }
}; 