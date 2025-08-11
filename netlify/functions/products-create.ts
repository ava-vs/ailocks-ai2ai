import type { Handler } from '@netlify/functions';
import { getAuthTokenFromHeaders, verifyToken } from '../../src/lib/auth/auth-utils';
import { digitalProductsService } from '../../src/lib/digital-products-service';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    if (!event.body) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body required' })
      };
    }

    const { 
      ownerAilockId, 
      title, 
      contentType, 
      size, 
      contentHash,
      policy = {}
    } = JSON.parse(event.body);

    // Validation
    if (!ownerAilockId || !title || !contentType || !size || !contentHash) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required fields: ownerAilockId, title, contentType, size, contentHash' 
        })
      };
    }

    // Size validation (200MB limit)
    const MAX_SIZE = 200 * 1024 * 1024; // 200MB
    if (size > MAX_SIZE) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `File size exceeds maximum limit of ${MAX_SIZE / (1024 * 1024)}MB` 
        })
      };
    }

    // Content type validation
    const allowedTypes = [
      'application/pdf',
      'application/zip',
      'application/x-tar',
      'application/gzip',
      'image/',
      'audio/',
      'video/',
      'text/',
      'application/json',
      'application/xml'
    ];

    const isAllowedType = allowedTypes.some(type => 
      contentType.startsWith(type) || contentType === type
    );

    if (!isAllowedType) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Content type not allowed. Supported types: PDF, archives, images, audio, video, text files' 
        })
      };
    }

    console.log('Products create:', { 
      ownerAilockId, 
      title, 
      contentType, 
      size,
      userId: payload.sub 
    });

    // Create product record (without actual file data yet)
    const productId = await digitalProductsService.createProduct(
      ownerAilockId,
      title,
      contentType,
      size,
      contentHash
    );

    console.log('Product created successfully:', { productId });

    return {
      statusCode: 201,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        ownerAilockId,
        title,
        contentType,
        size,
        contentHash,
        message: 'Product created successfully. Use upload-init to begin file upload.'
      })
    };

  } catch (error) {
    console.error('Products create error:', error);
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
