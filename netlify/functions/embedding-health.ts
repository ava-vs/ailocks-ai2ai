import type { Handler } from '@netlify/functions';
import { embeddingService } from '../../src/lib/embedding-service';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Check embedding coverage
    const coverage = await embeddingService.checkEmbeddingCoverage();

    // Check if OpenAI API is configured
    const openaiConfigured = !!process.env.OPENAI_API_KEY;

    // Test embedding generation if API key is available
    let testResult = null;
    if (openaiConfigured) {
      try {
        const testEmbedding = await embeddingService.generateEmbedding('test query for health check');
        testResult = {
          success: true,
          dimensions: testEmbedding.length,
          sampleValues: testEmbedding.slice(0, 3)
        };
      } catch (error) {
        testResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'healthy',
        openaiConfigured,
        embeddingCoverage: coverage,
        testResult,
        features: {
          semanticSearch: openaiConfigured && coverage.coverage > 0,
          vectorSimilarity: openaiConfigured,
          autoEmbedding: openaiConfigured
        },
        recommendations: getRecommendations(coverage, openaiConfigured),
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Embedding health check error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};

function getRecommendations(coverage: any, openaiConfigured: boolean): string[] {
  const recommendations = [];

  if (!openaiConfigured) {
    recommendations.push('Configure OPENAI_API_KEY to enable semantic search');
  }

  if (coverage.coverage < 50) {
    recommendations.push('Generate embeddings for existing intents to improve search quality');
  }

  if (coverage.coverage < 90 && openaiConfigured) {
    recommendations.push('Run batch embedding generation to achieve full coverage');
  }

  if (coverage.totalIntents === 0) {
    recommendations.push('Create some intents to test embedding functionality');
  }

  if (recommendations.length === 0) {
    recommendations.push('Embedding system is fully operational');
  }

  return recommendations;
}