import type { Handler } from '@netlify/functions';
import { ailockService } from '../../src/lib/ailock/core';
import { getAuthTokenFromHeaders, verifyToken } from '../../src/lib/auth/auth-utils';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headersBase,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const token = getAuthTokenFromHeaders(event.headers as any);
  if (!token) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) throw new Error('Invalid token');

    const tasks = await ailockService.getTasksForUser(decoded.sub);

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks)
    };
  } catch (error: any) {
    console.error('daily-tasks error', error);
    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch tasks', details: error.message || 'unknown' })
    };
  }
}; 