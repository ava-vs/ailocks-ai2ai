import type { Handler } from '@netlify/functions';
import { getAuthTokenFromHeaders, verifyToken } from '../../src/lib/auth/auth-utils';
import { DigitalProductsService } from '../../src/lib/digital-products-service';
import type { ChunkManifest } from '../../src/lib/digital-products-service';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

    const { uploadId, manifest } = JSON.parse(event.body);

    // Validation
    if (!uploadId || !manifest) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required fields: uploadId, manifest' 
        })
      };
    }

    // Validate manifest structure
    const requiredManifestFields = ['chunks', 'totalChunks', 'chunkSize', 'totalSize', 'contentHash'];
    for (const field of requiredManifestFields) {
      if (!(field in manifest)) {
        return {
          statusCode: 400,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: `Invalid manifest: missing field '${field}'` 
          })
        };
      }
    }

    // Validate chunks array
    if (!Array.isArray(manifest.chunks) || manifest.chunks.length !== manifest.totalChunks) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Invalid manifest: chunks array length does not match totalChunks' 
        })
      };
    }

    // Validate each chunk entry
    for (let i = 0; i < manifest.chunks.length; i++) {
      const chunk = manifest.chunks[i];
      if (!chunk.hasOwnProperty('index') || !chunk.hasOwnProperty('hash') || !chunk.hasOwnProperty('size')) {
        return {
          statusCode: 400,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: `Invalid manifest: chunk ${i} missing required fields (index, hash, size)` 
          })
        };
      }
      
      if (chunk.index !== i) {
        return {
          statusCode: 400,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            error: `Invalid manifest: chunk ${i} has incorrect index ${chunk.index}` 
          })
        };
      }
    }

    console.log('Products upload complete:', { 
      uploadId, 
      totalChunks: manifest.totalChunks,
      totalSize: manifest.totalSize,
      userId: payload.sub 
    });

    // Complete upload and persist manifest
    const result = await digitalProductsService.completeUpload(uploadId, manifest as ChunkManifest);

    console.log('Upload completed successfully:', { 
      uploadId, 
      productId: result.productId 
    });

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: result.success,
        productId: result.productId,
        manifest: {
          totalChunks: manifest.totalChunks,
          totalSize: manifest.totalSize,
          contentHash: manifest.contentHash
        },
        message: 'Upload completed successfully'
      })
    };

  } catch (error) {
    console.error('Products upload complete error:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'Upload session not found') {
        return {
          statusCode: 404,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Upload session not found or expired' })
        };
      }
      
      if (error.message === 'Not all chunks uploaded') {
        return {
          statusCode: 400,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Not all chunks have been uploaded' })
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
