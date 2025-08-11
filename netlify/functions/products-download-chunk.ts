import type { Handler } from '@netlify/functions';
import { getAuthTokenFromHeaders, verifyToken } from '../../src/lib/auth/auth-utils';
import { digitalProductsService } from '../../src/lib/digital-products-service';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  try {
    // Authentication
    const token = getAuthTokenFromHeaders(event.headers);
    if (!token) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    // Extract parameters from query string
    const productId = event.queryStringParameters?.productId;
    const chunkIndexStr = event.queryStringParameters?.chunkIndex;
    const requestingAilockId = event.queryStringParameters?.ailockId;

    if (!productId || !chunkIndexStr || !requestingAilockId) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required query parameters: productId, chunkIndex, ailockId' 
        })
      };
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid chunkIndex: must be a non-negative integer' })
      };
    }

    console.log('Products download chunk:', { 
      productId, 
      chunkIndex, 
      requestingAilockId,
      userId: payload.sub 
    });

    // Download chunk with access control
    const chunkData = await digitalProductsService.downloadChunk(
      productId,
      chunkIndex,
      requestingAilockId
    );

    if (!chunkData) {
      return {
        statusCode: 404,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Chunk not found' })
      };
    }

    console.log('Chunk downloaded successfully:', { 
      productId, 
      chunkIndex, 
      chunkSize: chunkData.length 
    });

    // Return chunk data as base64
    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        chunkIndex,
        chunkData: chunkData.toString('base64'),
        chunkSize: chunkData.length,
        message: 'Chunk downloaded successfully'
      })
    };

  } catch (error) {
    console.error('Products download chunk error:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'Access denied') {
        return {
          statusCode: 403,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Access denied: insufficient permissions to download this product' })
        };
      }
      
      if (error.message === 'Invalid chunk index') {
        return {
          statusCode: 400,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid chunk index' })
        };
      }
    }

    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
