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

    const { ailockId, skillId } = JSON.parse(body);

    if (!ailockId || !skillId) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Ailock ID and skill ID are required' })
      };
    }

    const success = await ailockService.upgradeSkill(ailockId, skillId);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success,
        message: success ? 'Skill upgraded successfully' : 'Failed to upgrade skill'
      })
    };

  } catch (error) {
    console.error('Ailock upgrade skill error:', error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: 'Failed to upgrade skill',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
