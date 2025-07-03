import type { Handler } from '@netlify/functions';
import { clearAuthCookie } from '../../src/lib/auth/auth-utils';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: headersBase,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Auth logout: clearing cookie');
    
    return {
      statusCode: 200,
      headers: {
        ...headersBase,
        'Content-Type': 'application/json',
        'Set-Cookie': clearAuthCookie()
      },
      body: JSON.stringify({ message: 'Logged out successfully' })
    };
  } catch (error) {
    console.error('Logout error', error);
    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 