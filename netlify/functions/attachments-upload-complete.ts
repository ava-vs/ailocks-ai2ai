import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface UploadCompleteRequest {
  uploadId: string;
  totalChunks: number;
  fileName: string;
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
    console.error('Attachments upload complete error:', error);
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
  const body: UploadCompleteRequest = JSON.parse(event.body || '{}');
  const { uploadId, totalChunks, fileName, contentType } = body;

  if (!uploadId || !totalChunks || !fileName || !contentType) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'uploadId, totalChunks, fileName, and contentType are required' 
      })
    };
  }

  // Generate mock attachment reference
  const attachmentRef = `mock-attachment-${uploadId}`;
  const mockHash = createHash('sha256').update(`${uploadId}-${fileName}`).digest('hex');

  console.log('Mock attachments-upload-complete called:', {
    uploadId,
    totalChunks,
    fileName,
    contentType,
    attachmentRef,
    userId: payload.sub
  });

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      attachmentRef,
      fileName,
      contentType,
      contentHash: mockHash,
      status: 'completed',
      message: 'Mock upload completed successfully (test mode)'
    })
  };
}

// Real implementation with storage finalization
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
  const body: UploadCompleteRequest = JSON.parse(event.body || '{}');
  const { uploadId, totalChunks, fileName, contentType } = body;

  if (!uploadId || !totalChunks || !fileName || !contentType) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'uploadId, totalChunks, fileName, and contentType are required' 
      })
    };
  }

  try {
    // TODO: Reassemble chunks from storage and create final file
    // 1. Retrieve all chunks for this uploadId
    // 2. Concatenate them in order
    // 3. Calculate content hash
    // 4. Store final file in permanent location
    // 5. Clean up temporary chunks
    
    // For now, generate a mock reference
    const attachmentRef = `attachment-${uploadId}`;
    const contentHash = createHash('sha256').update(`${uploadId}-${fileName}-${Date.now()}`).digest('hex');

    console.log('Attachment upload completed:', {
      uploadId,
      totalChunks,
      fileName,
      contentType,
      attachmentRef
    });

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        attachmentRef,
        fileName,
        contentType,
        contentHash,
        status: 'completed',
        message: 'Upload completed successfully'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Failed to complete upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}
