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

    const { uploadId, chunkIndex, chunkData } = JSON.parse(event.body);

    // Validation
    if (!uploadId || chunkIndex === undefined || !chunkData) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required fields: uploadId, chunkIndex, chunkData' 
        })
      };
    }

    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid chunkIndex' })
      };
    }

    // Convert base64 chunk data to Buffer
    let chunkBuffer: Buffer;
    try {
      chunkBuffer = Buffer.from(chunkData, 'base64');
    } catch (error) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid chunk data format (expected base64)' })
      };
    }

    // Size validation (max ~4MB to stay under Netlify Functions limit)
    const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
    if (chunkBuffer.length > MAX_CHUNK_SIZE) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: `Chunk size exceeds maximum limit of ${MAX_CHUNK_SIZE / (1024 * 1024)}MB` 
        })
      };
    }

    console.log('Products upload chunk:', { 
      uploadId, 
      chunkIndex, 
      chunkSize: chunkBuffer.length,
      userId: payload.sub 
    });

    // Upload chunk
    const result = await digitalProductsService.uploadChunk(
      uploadId,
      chunkIndex,
      chunkBuffer
    );

    console.log('Chunk uploaded successfully:', { 
      uploadId, 
      chunkIndex, 
      chunkHash: result.chunkHash 
    });

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: result.success,
        chunkIndex,
        chunkHash: result.chunkHash,
        message: 'Chunk uploaded successfully'
      })
    };

  } catch (error) {
    console.error('Products upload chunk error:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'Upload session not found') {
        return {
          statusCode: 404,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Upload session not found or expired' })
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
