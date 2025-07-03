import type { Handler } from '@netlify/functions';
import { AilockService } from '../../src/lib/ailock/core';

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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const url = new URL(event.rawUrl);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    const ailockService = new AilockService();
    const profile = await ailockService.getOrCreateAilock(userId);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // For local development
      },
      body: JSON.stringify({
        success: true,
        profile
      })
    };

  } catch (error) {
    console.error('Ailock profile error:', error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Failed to get Ailock profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
