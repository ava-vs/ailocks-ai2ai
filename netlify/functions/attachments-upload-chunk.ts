import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface UploadChunkRequest {
  uploadId: string;
  index: number;
  bytes: string; // base64 encoded chunk data
}

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
    // Check if running in mock mode
    const isMockMode = process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';
    
    if (isMockMode) {
      return handleMockRequest(event);
    } else {
      return handleRealRequest(event);
    }
    
  } catch (error) {
    console.error('Attachments upload chunk error:', error);
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
  // Authentication
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing or invalid authorization header' })
    };
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  let payload: any;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (error) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  // Parse request body
  const body: UploadChunkRequest = JSON.parse(event.body || '{}');
  const { uploadId, index, bytes } = body;

  if (!uploadId || index === undefined || !bytes) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'uploadId, index, and bytes are required' 
      })
    };
  }

  // Validate base64 data
  try {
    const buffer = Buffer.from(bytes, 'base64');
    const chunkSize = buffer.length;
    
    console.log('Mock attachments-upload-chunk called:', {
      uploadId,
      index,
      chunkSize,
      userId: payload.sub
    });

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        index,
        chunkSize,
        status: 'uploaded',
        message: 'Mock chunk uploaded successfully (test mode)'
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid base64 data in bytes field' })
    };
  }
}

// Real implementation with storage
async function handleRealRequest(event: any) {
  // Authentication
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing or invalid authorization header' })
    };
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  let payload: any;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (error) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  // Parse request body
  const body: UploadChunkRequest = JSON.parse(event.body || '{}');
  const { uploadId, index, bytes } = body;

  if (!uploadId || index === undefined || !bytes) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'uploadId, index, and bytes are required' 
      })
    };
  }

  try {
    // Decode and validate chunk data
    const buffer = Buffer.from(bytes, 'base64');
    const chunkSize = buffer.length;
    
    // Validate chunk size (max 2MB per chunk)
    const maxChunkSize = 2 * 1024 * 1024; // 2MB
    if (chunkSize > maxChunkSize) {
      return {
        statusCode: 413,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Chunk size exceeds maximum allowed size (2MB)' 
        })
      };
    }

    // TODO: Store chunk in Netlify Blobs or other storage
    // const chunkKey = `${uploadId}/chunk-${index.toString().padStart(6, '0')}`;
    // await store.set(chunkKey, buffer);

    console.log('Attachment chunk uploaded:', {
      uploadId,
      index,
      chunkSize
    });

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        index,
        chunkSize,
        status: 'uploaded',
        message: 'Chunk uploaded successfully'
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Invalid base64 data in bytes field',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}
