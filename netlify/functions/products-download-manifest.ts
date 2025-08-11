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

    // Extract productId and requestingAilockId from query parameters
    const productId = event.queryStringParameters?.productId;
    const requestingAilockId = event.queryStringParameters?.ailockId;

    if (!productId || !requestingAilockId) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required query parameters: productId, ailockId' 
        })
      };
    }

    console.log('Products download manifest:', { 
      productId, 
      requestingAilockId,
      userId: payload.sub 
    });

    // Get product manifest with access control
    const manifest = await digitalProductsService.getProductManifest(
      productId,
      requestingAilockId
    );

    if (!manifest) {
      return {
        statusCode: 404,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Product not found or manifest not available' })
      };
    }

    console.log('Manifest retrieved successfully:', { 
      productId, 
      totalChunks: manifest.totalChunks,
      totalSize: manifest.totalSize 
    });

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        manifest,
        message: 'Manifest retrieved successfully'
      })
    };

  } catch (error) {
    console.error('Products download manifest error:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'Access denied') {
        return {
          statusCode: 403,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Access denied: insufficient permissions to download this product' })
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
