import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { db } from '../../src/lib/db';
import { productTransfers, productKeys, digitalProducts, ailocks } from '../../src/lib/schema';
import { eq, and } from 'drizzle-orm';
import { DigitalProductsService } from '../../src/lib/digital-products-service';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface GrantRequest {
  transferId: string;
  recipientPublicKey?: string; // X25519 public key for key envelope
}

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
    // Check if running in mock mode
    const isMockMode = process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';
    
    if (isMockMode) {
      return handleMockRequest(event);
    } else {
      return handleRealRequest(event);
    }
    
  } catch (error) {
    console.error('Products grant error:', error);
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
  const body: GrantRequest = JSON.parse(event.body || '{}');
  const { transferId, recipientPublicKey } = body;

  if (!transferId) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required field: transferId' })
    };
  }

  // Generate mock claim token
  const claimToken = jwt.sign(
    {
      transferId,
      productId: 'mock-product-id',
      recipientAilockId: 'mock-recipient-ailock',
      keyId: 'mock-key-id',
      type: 'claim'
    },
    jwtSecret,
    { expiresIn: '24h' }
  );

  // Mock key envelope
  const mockKeyEnvelope = Buffer.from(JSON.stringify({
    productId: 'mock-product-id',
    transferId: transferId,
    timestamp: Date.now(),
    encryptedKey: 'mock_encrypted_aes_key_' + Math.random().toString(36).substring(2)
  })).toString('base64');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  console.log('Mock products-grant called:', {
    transferId,
    userId: payload.sub,
    claimTokenGenerated: true
  });

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      productId: 'mock-product-id',
      productTitle: 'Mock SotA Solutions',
      keyEnvelope: mockKeyEnvelope,
      claimToken,
      expiresAt: expiresAt.toISOString(),
      status: 'delivered',
      message: 'Mock delivery ticket issued successfully'
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
  const body: GrantRequest = JSON.parse(event.body || '{}');
  const { transferId, recipientPublicKey } = body;

  if (!transferId) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required field: transferId' })
    };
  }

  // Find transfer and verify that current user is the recipient (buyer)
  console.log('products-grant: Looking for transfer:', transferId, 'for user:', payload.sub);
  
  const [transferData] = await db.select({
    product_transfers: {
      id: productTransfers.id,
      productId: productTransfers.productId,
      fromAilockId: productTransfers.fromAilockId,
      toAilockId: productTransfers.toAilockId,
      status: productTransfers.status,
      buyerInputs: productTransfers.buyerInputs
    },
    digital_products: {
      id: digitalProducts.id,
      title: digitalProducts.title,
      ownerAilockId: digitalProducts.ownerAilockId,
      storagePointer: digitalProducts.storagePointer
    },
    recipient_ailock: {
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

  console.log('products-grant: Transfer data found:', transferData ? 'YES' : 'NO');
  if (transferData) {
    console.log('products-grant: Transfer status:', transferData.product_transfers.status);
    console.log('products-grant: Recipient ailock:', transferData.recipient_ailock.id, 'user:', transferData.recipient_ailock.userId);
  }

  if (!transferData) {
    return {
      statusCode: 404,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Transfer not found or access denied' })
    };
  }

  const transfer = transferData.product_transfers;
  const product = transferData.digital_products;

  // Verify transfer is paid (or invoiced for testing without real Stripe)
  const allowedStatuses = ['paid', 'invoiced']; // Allow invoiced for testing without real payment
  if (!transfer.status || !allowedStatuses.includes(transfer.status)) {
    return {
      statusCode: 403,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Transfer must be paid or invoiced before granting access',
        currentStatus: transfer.status || 'unknown',
        allowedStatuses
      })
    };
  }

  // Check if key envelope already exists
  const [existingKey] = await db.select()
    .from(productKeys)
    .where(and(
      eq(productKeys.productId, product.id),
      eq(productKeys.recipientAilockId, transfer.toAilockId)
    ))
    .limit(1);

  let keyId: string;
  let keyEnvelope: string;

  if (existingKey && existingKey.expiresAt && new Date(existingKey.expiresAt) > new Date()) {
    // Use existing valid key
    keyId = existingKey.id;
    keyEnvelope = existingKey.keyEnvelope;
  } else {
    // Generate new key envelope
    // For MVP, we'll use a mock key envelope
    // In production, this would use X25519 to encrypt the AES key
    const mockKeyEnvelope = Buffer.from(JSON.stringify({
      productId: product.id,
      transferId: transferId,
      timestamp: Date.now(),
      // This would be the actual encrypted AES key in production
      encryptedKey: 'mock_encrypted_aes_key_' + Math.random().toString(36).substring(2)
    })).toString('base64');

    // Set expiration (7 days from now by default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create or update key envelope
    if (existingKey) {
      await db.update(productKeys)
        .set({
          keyEnvelope: mockKeyEnvelope,
          expiresAt,
        })
        .where(eq(productKeys.id, existingKey.id));
      keyId = existingKey.id;
    } else {
      const [newKey] = await db.insert(productKeys).values({
        productId: product.id,
        recipientAilockId: transfer.toAilockId,
        keyEnvelope: mockKeyEnvelope,
        expiresAt,
      }).returning();
      keyId = newKey.id;
    }

    keyEnvelope = mockKeyEnvelope;
  }

  // Update transfer status to delivered
  await db.update(productTransfers)
    .set({ 
      status: 'delivered',
      updatedAt: new Date()
    })
    .where(eq(productTransfers.id, transferId));

  // Generate claim token (JWT with short TTL)
  const claimToken = jwt.sign(
    {
      transferId,
      productId: product.id,
      recipientAilockId: transfer.toAilockId,
      keyId,
      type: 'claim'
    },
    jwtSecret,
    { expiresIn: '24h' } // Claim token valid for 24 hours
  );

  console.log('Product access granted:', {
    transferId,
    productId: product.id,
    recipientAilockId: transfer.toAilockId,
    keyId
  });

  // TODO: Send product_delivery message via AilockMessageService
  // This would notify the recipient that the product is ready for download

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      productId: product.id,
      productTitle: product.title,
      keyEnvelope,
      claimToken,
      expiresAt: existingKey?.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'delivered',
      message: 'Delivery ticket issued successfully'
    })
  };
}
