import type { Handler } from '@netlify/functions';
import { getAuthTokenFromHeaders, verifyToken } from '../../src/lib/auth/auth-utils';
import { digitalProductsService } from '../../src/lib/digital-products-service';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Claim-Token',
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
    // Check if running in mock mode
    const isMockMode = process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';
    
    if (isMockMode) {
      return handleMockRequest(event);
    } else {
      return handleRealRequest(event);
    }
    
  } catch (error) {
    console.error('Products download chunk error:', error);
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

  const chunkIndex = parseInt(event.queryStringParameters?.chunkIndex || event.queryStringParameters?.index || '0');
  const productId = event.queryStringParameters?.productId || 'mock-product-id';
  const ailockId = event.queryStringParameters?.ailockId || 'mock-recipient-ailock';

  console.log('Mock products-download-chunk called:', {
    chunkIndex,
    productId,
    ailockId,
    hasClaimToken: !!claimToken
  });

  // Generate mock binary data for the chunk
  const chunkSize = chunkIndex < 2 ? 512000 : 0; // Last chunk is empty
  const mockData = Buffer.alloc(chunkSize);
  
  // Fill with some pattern data to make it more realistic
  for (let i = 0; i < chunkSize; i++) {
    mockData[i] = (chunkIndex * 256 + (i % 256)) & 0xFF;
  }

  return {
    statusCode: 200,
    headers: { 
      ...headersBase, 
      'Content-Type': 'application/octet-stream',
      'Content-Length': chunkSize.toString(),
      'Content-Disposition': `attachment; filename="mock-chunk-${chunkIndex}.bin"`
    },
    body: mockData.toString('base64'),
    isBase64Encoded: true
  };
}

// Real implementation with database and storage
async function handleRealRequest(event: any) {
  // Get claim token from query parameter (primary method)
  const claimToken = event.queryStringParameters?.claim;
  
  // Fallback to other authentication methods
  const token = getAuthTokenFromHeaders(event.headers);
  
  if (!claimToken && !token) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication required (claim token or bearer token)' })
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
      const jwt = require('jsonwebtoken');
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

  // Extract chunk index (works for both claim and bearer token methods)
  const chunkIndexStr = event.queryStringParameters?.chunkIndex || event.queryStringParameters?.index;
  
  if (!chunkIndexStr) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Missing required query parameter: chunkIndex or index' 
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

  // Return chunk data as binary
  return {
    statusCode: 200,
    headers: { 
      ...headersBase, 
      'Content-Type': 'application/octet-stream',
      'Content-Length': chunkData.length.toString(),
      'Content-Disposition': `attachment; filename="chunk-${chunkIndex}.bin"`
    },
    body: chunkData.toString('base64'),
    isBase64Encoded: true
  };
}
