import type { Handler } from '@netlify/functions';
import { smartChainBuilder } from '../../src/lib/chain-builder';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
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
    const body = JSON.parse(event.body || '{}');
    const { intentId } = body;

    if (!intentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Intent ID is required' })
      };
    }

    console.log(`🔗 Creating smart chain for intent: ${intentId}`);

    // Create the smart chain
    const chainId = await smartChainBuilder.createSmartChain(intentId);

    // Get the chain progress to return detailed information
    const chainProgress = await smartChainBuilder.getChainProgress(chainId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        chainId,
        chain: chainProgress.chain,
        steps: chainProgress.steps,
        progress: chainProgress.progress,
        nextSteps: chainProgress.nextSteps,
        message: 'Smart chain created successfully'
      })
    };

  } catch (error) {
    console.error('Smart chain creation error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to create smart chain',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};