import type { Handler } from '@netlify/functions';
import { clearAuthCookie } from '../../../src/lib/auth/auth-utils';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: headersBase, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...headersBase, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  return {
    statusCode: 204,
    headers: { ...headersBase, 'Set-Cookie': clearAuthCookie() },
    body: ''
  };
};