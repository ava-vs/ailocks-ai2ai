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
      chunkSize = 4 * 1024 * 1024 // 4MB default
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

    // Chunk size validation (max 4.5MB to stay under Netlify Functions limit)
    const MAX_CHUNK_SIZE = 4.5 * 1024 * 1024; // 4.5MB
    if (chunkSize > MAX_CHUNK_SIZE) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `Chunk size exceeds maximum limit of ${MAX_CHUNK_SIZE / (1024 * 1024)}MB` 
        })
      };
    }

    console.log('Products upload init:', { 
      ownerAilockId, 
      title, 
      contentType, 
      size, 
      chunkSize,
      userId: payload.sub 
    });

    // Create product record
    const productId = await digitalProductsService.createProduct(
      ownerAilockId,
      title,
      contentType,
      size,
      contentHash
    );

    // Initialize chunked upload session
    const uploadSession = await digitalProductsService.initializeUpload(
      productId,
      size,
      chunkSize
    );

    console.log('Upload session created:', { 
      productId, 
      uploadId: uploadSession.uploadId,
      expectedChunks: uploadSession.expectedChunks 
    });

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        uploadId: uploadSession.uploadId,
        storagePrefix: uploadSession.storagePrefix,
        chunkSize: uploadSession.chunkSize,
        expectedChunks: uploadSession.expectedChunks,
        message: 'Upload session initialized successfully'
      })
    };

  } catch (error) {
    console.error('Products upload init error:', error);
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
