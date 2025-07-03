import type { Handler } from '@netlify/functions';
import { ailockService } from '../../src/lib/ailock/core';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const body = event.body;
    if (!body) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Request body is required' })
      };
    }

    const { ailockId, eventType, context = {} } = JSON.parse(body);
    console.log('Ailock gain XP request:', { ailockId, eventType, context });

    if (!ailockId || !eventType) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Ailock ID and event type are required' })
      };
    }

    const result = await ailockService.gainXp(ailockId, eventType, context);
    console.log('Ailock gain XP result:', result);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Ailock gain XP error:', error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Failed to gain XP',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
