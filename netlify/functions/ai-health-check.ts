import { UnifiedAIService } from '../../src/lib/ai-service';
import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const aiService = new UnifiedAIService();

  try {
    // A single call to the AI service is a more efficient health check.
    // A successful response implicitly confirms that the service and its providers are available.
    const testResponse = await aiService.generateWithCostOptimization(
      [{ role: 'user', content: 'Hello' }],
      { complexity: 'simple', budget: 'free' }
    );

    const isHealthy = testResponse.length > 0;

    // We can still get the list of providers for the response body.
    const health = await aiService.healthCheck();

    return {
      statusCode: isHealthy ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: isHealthy ? 'ok' : 'error',
        aiService: health, // This will report available providers
        testResponse: isHealthy ? 'success' : 'failed'
      }),
    };
  } catch (error: any) {
    console.error('AI Health Check failed:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'error',
        message: 'An error occurred during the health check.',
        error: error.message,
      }),
    };
  }
};
