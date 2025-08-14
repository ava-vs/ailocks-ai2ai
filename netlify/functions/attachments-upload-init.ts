import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface UploadInitRequest {
  transferId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
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
    console.error('Attachments upload init error:', error);
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
  const body: UploadInitRequest = JSON.parse(event.body || '{}');
  const { transferId, fileName, fileSize, contentType } = body;

  if (!transferId || !fileName || !fileSize || !contentType) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'transferId, fileName, fileSize, and contentType are required' 
      })
    };
  }

  // Generate mock upload session
  const uploadId = `mock-upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(fileSize / chunkSize);

  console.log('Mock attachments-upload-init called:', {
    transferId,
    fileName,
    fileSize,
    contentType,
    uploadId,
    userId: payload.sub
  });

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      chunkSize,
      totalChunks,
      storagePrefix: `attachments/${transferId}/${uploadId}`,
      message: 'Mock upload session initialized (test mode)'
    })
  };
}

// Real implementation with database and storage
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
  const body: UploadInitRequest = JSON.parse(event.body || '{}');
  const { transferId, fileName, fileSize, contentType } = body;

  if (!transferId || !fileName || !fileSize || !contentType) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'transferId, fileName, fileSize, and contentType are required' 
      })
    };
  }

  // Validate file size (max 50MB for attachments)
  const maxFileSize = 50 * 1024 * 1024; // 50MB
  if (fileSize > maxFileSize) {
    return {
      statusCode: 413,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'File size exceeds maximum allowed size (50MB)' 
      })
    };
  }

  // Generate upload session
  const uploadId = uuidv4();
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(fileSize / chunkSize);
  const storagePrefix = `attachments/${transferId}/${uploadId}`;

  // TODO: Store upload session metadata in database or cache
  // For now, we'll rely on the client to track the upload state

  console.log('Attachment upload initialized:', {
    transferId,
    fileName,
    fileSize,
    contentType,
    uploadId,
    totalChunks
  });

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      chunkSize,
      totalChunks,
      storagePrefix,
      message: 'Upload session initialized successfully'
    })
  };
}
