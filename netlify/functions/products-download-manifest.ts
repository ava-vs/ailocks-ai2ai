import type { Handler } from '@netlify/functions';
import { getAuthTokenFromHeaders, verifyToken } from '../../src/lib/auth/auth-utils';
import { DigitalProductsService } from '../../src/lib/digital-products-service';
import jwt from 'jsonwebtoken';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Claim-Token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler: Handler = async (event) => {
  const digitalProductsService = new DigitalProductsService();
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
    // Check if running in mock mode
    const isMockMode = process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';
    
    if (isMockMode) {
      return handleMockRequest(event);
    } else {
      return handleRealRequest(event, digitalProductsService);
    }
    
  } catch (error) {
    console.error('Products download manifest error:', error);
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

// Mock implementation for testing
async function handleMockRequest(event: any) {
  // Get claim token from header or query parameter
  const claimToken = event.headers['x-claim-token'] || 
                    event.headers['X-Claim-Token'] || 
                    event.queryStringParameters?.claim;

  if (!claimToken) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing claim token' })
    };
  }

  const productId = event.queryStringParameters?.productId || 'mock-product-id';
  const ailockId = event.queryStringParameters?.ailockId || 'mock-recipient-ailock';

  console.log('Mock products-download-manifest called:', {
    productId,
    ailockId,
    hasClaimToken: !!claimToken
  });

  // Return mock manifest
  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId,
      productTitle: 'Mock SotA Solutions',
      version: '1.0.0',
      totalSize: 1024000,
      chunkCount: 3,
      chunkSize: 512000,
      contentType: 'application/zip',
      chunks: [
        {
          index: 0,
          size: 512000,
          hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
          url: `/.netlify/functions/products-download-chunk?productId=${productId}&ailockId=${ailockId}&chunkIndex=0`
        },
        {
          index: 1,
          size: 512000,
          hash: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567',
          url: `/.netlify/functions/products-download-chunk?productId=${productId}&ailockId=${ailockId}&chunkIndex=1`
        },
        {
          index: 2,
          size: 0,
          hash: 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
          url: `/.netlify/functions/products-download-chunk?productId=${productId}&ailockId=${ailockId}&chunkIndex=2`
        }
      ],
      createdAt: new Date().toISOString(),
      message: 'Mock manifest retrieved successfully'
    })
  };
}

// Real implementation with database and storage
async function handleRealRequest(event: any, digitalProductsService: DigitalProductsService) {
  // Get claim token from query parameter (primary method)
  const claimToken = event.queryStringParameters?.claim;
  
  // Fallback to other authentication methods
  const token = getAuthTokenFromHeaders(event.headers);
  const downloadToken = event.headers['x-download-token'] || 
                       event.queryStringParameters?.downloadToken;

  if (!claimToken && !token && !downloadToken) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication required (claim token, bearer token, or download token)' })
    };
  }

  let payload: any;
  let productId: string;
  let requestingAilockId: string;

  if (claimToken) {
    // Verify claim token and extract product/ailock info
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    try {
      payload = jwt.verify(claimToken, jwtSecret);
      if (payload.type !== 'claim') {
        throw new Error('Invalid token type');
      }
      productId = payload.productId;
      requestingAilockId = payload.recipientAilockId;
    } catch (error) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid claim token' })
      };
    }
  } else if (downloadToken) {
    // Verify download token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    try {
      payload = jwt.verify(downloadToken, jwtSecret);
      if (payload.type !== 'download') {
        throw new Error('Invalid token type');
      }
      productId = payload.productId;
      requestingAilockId = payload.recipientAilockId;
    } catch (error) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid download token' })
      };
    }
  } else {
    // Verify regular Bearer token and extract from query params
    payload = verifyToken(token!);
    if (!payload) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }
    
    // Extract parameters from query string
    productId = event.queryStringParameters?.productId;
    requestingAilockId = event.queryStringParameters?.ailockId;

    if (!productId || !requestingAilockId) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required query parameters: productId, ailockId' 
        })
      };
    }
  }

  console.log('Products download manifest:', { 
    productId, 
    requestingAilockId,
    userId: payload.sub,
    tokenType: payload.type || 'bearer'
  });

  // Get manifest with access control
  const manifest = await digitalProductsService.getProductManifest(
    productId,
    requestingAilockId
  );

  if (!manifest) {
    return {
      statusCode: 404,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Manifest not found or access denied' })
    };
  }

  console.log('Manifest retrieved successfully:', { 
    productId, 
    chunkCount: manifest.chunks?.length || 0,
    totalSize: manifest.totalSize
  });

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...manifest,
      message: 'Manifest retrieved successfully'
    })
  };
}
