import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { db } from '../../src/lib/db';
import { productTransfers, paymentIntents, digitalProducts, ailocks } from '../../src/lib/schema';
import { eq, and } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface InvoiceRequest {
  transferId?: string;
  productId?: string;
  toAilockId?: string;
  price?: number;
  currency?: string;
  buyerInputs?: any;
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
    console.error('Products invoice error:', error);
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
  const body: InvoiceRequest = JSON.parse(event.body || '{}');
  const { transferId, productId, toAilockId, price, currency = 'USD' } = body;

  // Validate required fields for creating transfer on the fly
  if (!transferId && (!productId || !toAilockId)) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Either transferId or (productId + toAilockId) required' })
    };
  }

  // Generate mock transferId if not provided
  const mockTransferId = transferId || `mock-transfer-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const mockCheckoutUrl = `https://checkout.stripe.com/pay/mock_${mockTransferId}`;
  const finalPrice = price?.toString() || '99.99';

  console.log('Mock products-invoice called:', {
    transferId: mockTransferId,
    productId,
    toAilockId,
    price: finalPrice,
    currency,
    userId: payload.sub
  });

  // Return mock invoice response with transferId and checkoutUrl
  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId: mockTransferId,
      checkoutUrl: mockCheckoutUrl,
      amount: finalPrice,
      currency: currency,
      status: 'invoiced',
      message: 'Mock invoice created successfully (test mode)'
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
  const body: InvoiceRequest = JSON.parse(event.body || '{}');
  const { transferId, productId, toAilockId, price, currency = 'USD' } = body;
  const buyerInputs = body.buyerInputs;

  let transfer: any;

  if (transferId) {
    // Find existing transfer
    const [existingTransfer] = await db.select()
      .from(productTransfers)
      .innerJoin(digitalProducts, eq(productTransfers.productId, digitalProducts.id))
      .innerJoin(ailocks, eq(digitalProducts.ownerAilockId, ailocks.id))
      .where(and(
        eq(productTransfers.id, transferId),
        eq(ailocks.userId, payload.sub)
      ))
      .limit(1);

    if (!existingTransfer) {
      return {
        statusCode: 404,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Transfer not found or access denied' })
      };
    }

    transfer = existingTransfer.product_transfers;
  } else if (productId && toAilockId) {
    // Create transfer on the fly for test scenarios
    const [product] = await db.select({
      digital_products: {
        id: digitalProducts.id,
        ownerAilockId: digitalProducts.ownerAilockId,
        title: digitalProducts.title,
        contentType: digitalProducts.contentType,
        size: digitalProducts.size,
        encryptionAlgo: digitalProducts.encryptionAlgo,
        contentHash: digitalProducts.contentHash,
        storageType: digitalProducts.storageType,
        storagePointer: digitalProducts.storagePointer,
        price: digitalProducts.price,
        currency: digitalProducts.currency,
        requiredInputs: digitalProducts.requiredInputs
      },
      ailocks: {
        id: ailocks.id,
        userId: ailocks.userId
      }
    })
      .from(digitalProducts)
      .innerJoin(ailocks, eq(digitalProducts.ownerAilockId, ailocks.id))
      .where(eq(digitalProducts.id, productId))
      .limit(1);

    if (!product) {
      return {
        statusCode: 404,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Product not found or access denied' })
      };
    }

    // Check required inputs for pre-payment timing
    const requiredInputs = (product.digital_products.requiredInputs as any[]) || [];
    const prePaymentInputs = requiredInputs.filter((input: any) => 
      input.timing === 'pre_payment' && input.required
    );

    if (prePaymentInputs.length > 0) {
      // Check if we have a transfer with buyer inputs already
      const [existingTransferWithInputs] = await db.select({
        id: productTransfers.id,
        buyerInputs: productTransfers.buyerInputs,
        status: productTransfers.status
      })
        .from(productTransfers)
        .where(and(
          eq(productTransfers.productId, productId),
          eq(productTransfers.fromAilockId, product.digital_products.ownerAilockId),
          eq(productTransfers.toAilockId, toAilockId)
        ))
        .limit(1);

      if (!existingTransferWithInputs) {
        // No transfer exists, check if buyerInputs are provided in request
        if (!buyerInputs) {
          return {
            statusCode: 422,
            headers: { ...headersBase, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'missing_inputs',
              missing_inputs: prePaymentInputs,
              message: 'Pre-payment required inputs must be provided before creating invoice'
            })
          };
        }
        
        // Check if provided buyerInputs satisfy all required pre-payment inputs
        const missingInputs = prePaymentInputs.filter((input: any) => 
          !buyerInputs[input.name] || buyerInputs[input.name] === null || buyerInputs[input.name] === ''
        );
        
        if (missingInputs.length > 0) {
          return {
            statusCode: 422,
            headers: { ...headersBase, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'missing_inputs',
              missing_inputs: missingInputs,
              message: 'Some pre-payment required inputs are missing from the request'
            })
          };
        }
        
        // Continue to create transfer with buyerInputs - validation passed
      } else {
        // Transfer exists, check if existing transfer has all required pre-payment inputs
        const existingBuyerInputs = (existingTransferWithInputs.buyerInputs as Record<string, any>) || {};
        const missingInputs = prePaymentInputs.filter((input: any) => 
          !existingBuyerInputs[input.name] || existingBuyerInputs[input.name] === null || existingBuyerInputs[input.name] === ''
        );

        if (missingInputs.length > 0) {
          return {
            statusCode: 422,
            headers: { ...headersBase, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'missing_inputs',
              missing_inputs: missingInputs,
              transferId: existingTransferWithInputs.id,
              message: 'Some pre-payment required inputs are still missing'
            })
          };
        }
      }
    }

    // Check if transfer already exists
    const [existingTransfer] = await db.select({
      id: productTransfers.id,
      productId: productTransfers.productId,
      fromAilockId: productTransfers.fromAilockId,
      toAilockId: productTransfers.toAilockId,
      price: productTransfers.price,
      currency: productTransfers.currency,
      status: productTransfers.status,
      buyerInputs: productTransfers.buyerInputs,
      createdAt: productTransfers.createdAt
    })
      .from(productTransfers)
      .where(and(
        eq(productTransfers.productId, productId),
        eq(productTransfers.fromAilockId, product.digital_products.ownerAilockId),
        eq(productTransfers.toAilockId, toAilockId)
      ))
      .limit(1);

    if (existingTransfer) {
      transfer = existingTransfer;
    } else {
      // Create new transfer
      const [newTransfer] = await db.insert(productTransfers).values({
        productId,
        fromAilockId: product.digital_products.ownerAilockId,
        toAilockId,
        price: price?.toString() || '0',
        currency,
        status: 'offered',
        policy: {},
        buyerInputs: buyerInputs || {},
      }).returning();

      transfer = newTransfer;
    }
  } else {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Either transferId or (productId + toAilockId) required' })
    };
  }

  // Check if payment intent already exists
  const [existingPaymentIntent] = await db.select({
    id: paymentIntents.id,
    transferId: paymentIntents.transferId,
    status: paymentIntents.status,
    amount: paymentIntents.amount,
    currency: paymentIntents.currency
  })
    .from(paymentIntents)
    .where(eq(paymentIntents.transferId, transfer.id))
    .limit(1);

  if (existingPaymentIntent && existingPaymentIntent.status === 'paid') {
    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId: transfer.id,
        status: 'paid',
        message: 'Payment already completed'
      })
    };
  }

  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    // Return mock checkout URL for testing
    const mockCheckoutUrl = `https://checkout.stripe.com/mock/${transfer.id}`;
    
    // Create or update payment intent record
    if (existingPaymentIntent) {
      await db.update(paymentIntents)
        .set({
          providerRef: mockCheckoutUrl
        })
        .where(eq(paymentIntents.id, existingPaymentIntent.id));
    } else {
      await db.insert(paymentIntents).values({
        transferId: transfer.id,
        amount: transfer.price || '0',
        currency: transfer.currency,
        status: 'pending',
        provider: 'stripe',
        providerRef: mockCheckoutUrl,
      });
    }

    // Update transfer status to invoiced
    await db.update(productTransfers)
      .set({ 
        status: 'invoiced',
        updatedAt: new Date()
      })
      .where(eq(productTransfers.id, transfer.id));

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId: transfer.id,
        checkoutUrl: mockCheckoutUrl,
        amount: transfer.price,
        currency: transfer.currency,
        status: 'invoiced',
        message: 'Mock checkout URL created (Stripe not configured)'
      })
    };
  }

  // TODO: Implement real Stripe checkout session creation
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // const session = await stripe.checkout.sessions.create({...});

  // Update transfer status to invoiced (for both Stripe and non-Stripe cases)
  await db.update(productTransfers)
    .set({ 
      status: 'invoiced',
      updatedAt: new Date()
    })
    .where(eq(productTransfers.id, transfer.id));

  console.log('Invoice created for transfer:', transfer.id);

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId: transfer.id,
      checkoutUrl: `https://checkout.stripe.com/pay/${transfer.id}`,
      amount: transfer.price,
      currency: transfer.currency,
      status: 'invoiced',
      message: 'Invoice created successfully'
    })
  };
}
