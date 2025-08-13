import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { db } from '../../src/lib/db';
import { digitalProducts, productTransfers, ailocks } from '../../src/lib/schema';
import { eq, and } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface OfferRequest {
  productId: string;
  toAilockId: string;
  price?: number;
  currency?: string;
  policy?: any;
  message?: string;
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
    const body: OfferRequest = JSON.parse(event.body || '{}');
    const { productId, toAilockId, price, currency = 'USD', policy, message } = body;

    if (!productId || !toAilockId) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: productId, toAilockId' })
      };
    }

    // Verify product exists and user owns it
    const [product] = await db.select()
      .from(digitalProducts)
      .innerJoin(ailocks, eq(digitalProducts.ownerAilockId, ailocks.id))
      .where(and(
        eq(digitalProducts.id, productId),
        eq(ailocks.userId, payload.sub)
      ))
      .limit(1);

    if (!product) {
      return {
        statusCode: 404,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Product not found or access denied' })
      };
    }

    // Verify target ailock exists
    const [targetAilock] = await db.select()
      .from(ailocks)
      .where(eq(ailocks.id, toAilockId))
      .limit(1);

    if (!targetAilock) {
      return {
        statusCode: 404,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Target ailock not found' })
      };
    }

    // Check for existing transfer
    const [existingTransfer] = await db.select()
      .from(productTransfers)
      .where(and(
        eq(productTransfers.productId, productId),
        eq(productTransfers.fromAilockId, product.digital_products.ownerAilockId),
        eq(productTransfers.toAilockId, toAilockId)
      ))
      .limit(1);

    if (existingTransfer && existingTransfer.status && ['offered', 'invoiced', 'paid'].includes(existingTransfer.status)) {
      return {
        statusCode: 409,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Transfer already exists',
          transferId: existingTransfer.id,
          status: existingTransfer.status
        })
      };
    }

    // Create transfer
    const [transfer] = await db.insert(productTransfers).values({
      productId,
      fromAilockId: product.digital_products.ownerAilockId,
      toAilockId,
      price: price?.toString(),
      currency,
      status: 'offered',
      policy: policy || {},
    }).returning();

    console.log('Product offer created:', {
      transferId: transfer.id,
      productId,
      fromAilockId: product.digital_products.ownerAilockId,
      toAilockId,
      price
    });

    // TODO: Send product_offer message via AilockMessageService
    // This would integrate with the messaging system to notify the recipient

    return {
      statusCode: 201,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId: transfer.id,
        status: 'offered',
        productTitle: product.digital_products.title,
        price,
        currency,
        message: 'Product offer created successfully'
      })
    };

  } catch (error) {
    console.error('Products offer error:', error);
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
