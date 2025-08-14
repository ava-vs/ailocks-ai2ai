import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { db } from '../../src/lib/db';
import { productKeys, productTransfers, digitalProducts } from '../../src/lib/schema';
import { eq, and } from 'drizzle-orm';

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
    console.error('Products claim error:', error);
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

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  // Verify claim token
  let claimPayload: any;
  try {
    claimPayload = jwt.verify(claimToken, jwtSecret);
  } catch (error) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired claim token' })
    };
  }

  // Validate claim token structure
  if (claimPayload.type !== 'claim' || !claimPayload.transferId) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid claim token format' })
    };
  }

  const { transferId, productId, recipientAilockId, keyId } = claimPayload;

  // Generate download access token (shorter TTL for actual downloads)
  const downloadToken = jwt.sign(
    {
      transferId,
      productId: productId || 'mock-product-id',
      recipientAilockId: recipientAilockId || 'mock-recipient-ailock',
      type: 'download'
    },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const baseUrl = `${event.headers['x-forwarded-proto'] || 'http'}://${event.headers.host}`;

  console.log('Mock products-claim called:', {
    transferId,
    productId: productId || 'mock-product-id',
    recipientAilockId: recipientAilockId || 'mock-recipient-ailock'
  });

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      productId: productId || 'mock-product-id',
      productTitle: 'Mock SotA Solutions',
      productSize: 1024000,
      contentType: 'application/zip',
      keyEnvelope: 'mock-key-envelope-base64',
      downloadToken,
      expiresAt: expiresAt.toISOString(),
      manifest: {
        chunkCount: 3,
        totalSize: 1024000,
        chunks: [
          { index: 0, size: 512000, hash: 'mock-hash-0' },
          { index: 1, size: 512000, hash: 'mock-hash-1' },
          { index: 2, size: 0, hash: 'mock-hash-2' }
        ]
      },
      downloadUrls: {
        manifest: `${baseUrl}/.netlify/functions/products-download-manifest?productId=${productId || 'mock-product-id'}&ailockId=${recipientAilockId || 'mock-recipient-ailock'}`,
        chunk: `${baseUrl}/.netlify/functions/products-download-chunk?productId=${productId || 'mock-product-id'}&ailockId=${recipientAilockId || 'mock-recipient-ailock'}&chunkIndex=`
      },
      status: 'ready_for_download',
      message: 'Mock access details retrieved successfully'
    })
  };
}

// Real implementation with database
async function handleRealRequest(event: any) {
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

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  // Verify claim token
  let claimPayload: any;
  try {
    claimPayload = jwt.verify(claimToken, jwtSecret);
  } catch (error) {
    return {
      statusCode: 401,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired claim token' })
    };
  }

  // Validate claim token structure
  if (claimPayload.type !== 'claim' || !claimPayload.transferId || !claimPayload.productId) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid claim token format' })
    };
  }

  const { transferId, productId, recipientAilockId, keyId } = claimPayload;

  // Verify transfer exists and is in delivered status
  const [transfer] = await db.select({
    id: productTransfers.id,
    productId: productTransfers.productId,
    toAilockId: productTransfers.toAilockId,
    status: productTransfers.status
  })
    .from(productTransfers)
    .where(and(
      eq(productTransfers.id, transferId),
      eq(productTransfers.productId, productId),
      eq(productTransfers.toAilockId, recipientAilockId)
    ))
    .limit(1);

  if (!transfer) {
    return {
      statusCode: 404,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Transfer not found' })
    };
  }

  if (!transfer.status || !['delivered', 'acknowledged'].includes(transfer.status)) {
    return {
      statusCode: 403,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Transfer not ready for claim',
        currentStatus: transfer.status || 'unknown'
      })
    };
  }

  // Get product details
  const [product] = await db.select({
    id: digitalProducts.id,
    title: digitalProducts.title,
    size: digitalProducts.size,
    contentType: digitalProducts.contentType,
    manifest: digitalProducts.manifest,
    storagePointer: digitalProducts.storagePointer,
    storageType: digitalProducts.storageType
  })
    .from(digitalProducts)
    .where(eq(digitalProducts.id, productId))
    .limit(1);

  if (!product) {
    return {
      statusCode: 404,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Product not found' })
    };
  }

  // Get key envelope
  const [key] = await db.select()
    .from(productKeys)
    .where(and(
      eq(productKeys.id, keyId),
      eq(productKeys.productId, productId),
      eq(productKeys.recipientAilockId, recipientAilockId)
    ))
    .limit(1);

  if (!key) {
    return {
      statusCode: 404,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Key envelope not found' })
    };
  }

  // Check if key has expired
  if (!key.expiresAt || new Date(key.expiresAt) <= new Date()) {
    return {
      statusCode: 403,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Key envelope has expired' })
    };
  }

  // Generate download access token (shorter TTL for actual downloads)
  const downloadToken = jwt.sign(
    {
      transferId,
      productId,
      recipientAilockId,
      type: 'download'
    },
    jwtSecret,
    { expiresIn: '1h' } // Download token valid for 1 hour
  );

  console.log('Product claim processed:', {
    transferId,
    productId,
    recipientAilockId
  });

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      productId,
      productTitle: product.title,
      productSize: product.size,
      contentType: product.contentType,
      keyEnvelope: key.keyEnvelope,
      downloadToken,
      expiresAt: key.expiresAt,
      manifest: product.manifest,
      downloadUrls: {
        manifest: `/.netlify/functions/products-download-manifest?productId=${productId}&ailockId=${recipientAilockId}`,
        chunk: `/.netlify/functions/products-download-chunk?productId=${productId}&ailockId=${recipientAilockId}&chunkIndex=`
      },
      status: 'ready_for_download',
      message: 'Access details retrieved successfully'
    })
  };
}
