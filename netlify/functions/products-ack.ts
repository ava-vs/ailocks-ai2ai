import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { db } from '../../src/lib/db';
import { deliveryReceipts, productTransfers, digitalProducts, ailocks } from '../../src/lib/schema';
import { eq, and } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface AckRequest {
  transferId: string;
  clientHash: string; // SHA-256 hash of decrypted content
  signature: string;  // Ed25519 signature
  meta?: any;
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
    console.error('Products ack error:', error);
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
  const body: AckRequest = JSON.parse(event.body || '{}');
  const { transferId, clientHash, signature, meta = {} } = body;

  if (!transferId || !clientHash || !signature) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required fields: transferId, clientHash, signature' })
    };
  }

  // Validate signature format (minimum 64 characters for Ed25519)
  if (signature.length < 64) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid signature format (minimum 64 characters required)' })
    };
  }

  // Validate client hash format (should be SHA-256)
  if (!/^[a-fA-F0-9]{64}$/.test(clientHash)) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid client hash format (expected SHA-256 hex string)' })
    };
  }

  // Generate mock receipt ID
  const receiptId = `mock-receipt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const deliveredAt = new Date().toISOString();

  console.log('Mock products-ack called:', {
    receiptId,
    transferId,
    clientHash: clientHash.substring(0, 16) + '...',
    signatureLength: signature.length,
    userId: payload.sub
  });

  return {
    statusCode: 201,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receiptId,
      transferId,
      status: 'acknowledged',
      deliveredAt,
      message: 'Mock delivery receipt created successfully'
    })
  };
}

// Real implementation with database
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
  const body: AckRequest = JSON.parse(event.body || '{}');
  const { transferId, clientHash, signature, meta = {} } = body;

  if (!transferId || !clientHash || !signature) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required fields: transferId, clientHash, signature' })
    };
  }

  // Validate signature format (minimum 64 characters for Ed25519)
  if (signature.length < 64) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid signature format (minimum 64 characters required)' })
    };
  }

  // Validate client hash format (should be SHA-256)
  if (!/^[a-fA-F0-9]{64}$/.test(clientHash)) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid client hash format (expected SHA-256 hex string)' })
    };
  }

  // Find transfer and verify it belongs to the authenticated user (recipient)
  const [transferData] = await db.select({
    product_transfers: {
      id: productTransfers.id,
      status: productTransfers.status,
      productId: productTransfers.productId
    },
    digital_products: {
      id: digitalProducts.id
    },
    ailocks: {
      id: ailocks.id,
      userId: ailocks.userId
    }
  })
    .from(productTransfers)
    .innerJoin(digitalProducts, eq(productTransfers.productId, digitalProducts.id))
    .innerJoin(ailocks, eq(productTransfers.toAilockId, ailocks.id))
    .where(and(
      eq(productTransfers.id, transferId),
      eq(ailocks.userId, payload.sub)
    ))
    .limit(1);

  if (!transferData) {
    return {
      statusCode: 404,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Transfer not found or access denied' })
    };
  }

  const transfer = transferData.product_transfers;
  const product = transferData.digital_products;

  // Verify transfer is in delivered status
  if (!transfer.status || transfer.status !== 'delivered') {
    return {
      statusCode: 403,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Transfer must be delivered before acknowledgment',
        currentStatus: transfer.status || 'unknown'
      })
    };
  }

  // Check if receipt already exists
  const [existingReceipt] = await db.select()
    .from(deliveryReceipts)
    .where(eq(deliveryReceipts.transferId, transferId))
    .limit(1);

  if (existingReceipt) {
    return {
      statusCode: 409,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Delivery receipt already exists for this transfer',
        receiptId: existingReceipt.id
      })
    };
  }

  // TODO: Verify Ed25519 signature against clientHash
  // For MVP, we'll skip signature verification but log it
  console.log('Signature verification skipped (MVP):', {
    transferId,
    clientHash: clientHash.substring(0, 16) + '...',
    signatureLength: signature.length
  });

  // Create delivery receipt
  const [receipt] = await db.insert(deliveryReceipts).values({
    transferId,
    clientHash,
    signature,
    meta: meta || {},
    deliveredAt: new Date()
  }).returning({ 
    id: deliveryReceipts.id,
    deliveredAt: deliveryReceipts.deliveredAt
  });

  // Update transfer status to acknowledged
  await db.update(productTransfers)
    .set({ 
      status: 'acknowledged',
      updatedAt: new Date()
    })
    .where(eq(productTransfers.id, transferId));

  console.log('Delivery receipt created:', {
    receiptId: receipt.id,
    transferId,
    productId: product.id,
    userId: payload.sub
  });

  // TODO: Send delivery_receipt message via AilockMessageService
  // This would notify the sender that the product was successfully received

  return {
    statusCode: 201,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receiptId: receipt.id,
      transferId,
      status: 'acknowledged',
      deliveredAt: receipt.deliveredAt,
      message: 'Delivery receipt created successfully'
    })
  };
}
