import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { db } from '../../src/lib/db';
import { productTransfers, digitalProducts, ailocks } from '../../src/lib/schema';
import { eq, and } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface RequirementsSubmitRequest {
  transferId: string;
  inputs: Record<string, any>; // { field_name: value_or_attachment_ref }
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
    console.error('Transfers requirements submit error:', error);
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
  const body: RequirementsSubmitRequest = JSON.parse(event.body || '{}');
  const { transferId, inputs } = body;

  if (!transferId || !inputs) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'transferId and inputs are required' })
    };
  }

  console.log('Mock transfers-requirements-submit called:', {
    transferId,
    inputs,
    userId: payload.sub
  });

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      status: 'submitted',
      submittedInputs: Object.keys(inputs),
      message: 'Mock requirements submitted successfully (test mode)'
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
  const body: RequirementsSubmitRequest = JSON.parse(event.body || '{}');
  const { transferId, inputs } = body;

  if (!transferId || !inputs) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'transferId and inputs are required' })
    };
  }

  // Find the transfer and verify ownership
  const [transfer] = await db.select()
    .from(productTransfers)
    .innerJoin(digitalProducts, eq(productTransfers.productId, digitalProducts.id))
    .innerJoin(ailocks, eq(productTransfers.toAilockId, ailocks.id))
    .where(and(
      eq(productTransfers.id, transferId),
      eq(ailocks.userId, payload.sub)
    ))
    .limit(1);

  if (!transfer) {
    return {
      statusCode: 404,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Transfer not found or access denied' })
    };
  }

  // Get current buyer inputs
  const currentInputs = transfer.product_transfers.buyerInputs || {};
  
  // Merge new inputs with existing ones
  const updatedInputs = { ...currentInputs, ...inputs };

  // Update the transfer with new buyer inputs
  await db.update(productTransfers)
    .set({ 
      buyerInputs: updatedInputs,
      updatedAt: new Date()
    })
    .where(eq(productTransfers.id, transferId));

  console.log('Requirements submitted for transfer:', transferId);

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      status: 'submitted',
      submittedInputs: Object.keys(inputs),
      message: 'Requirements submitted successfully'
    })
  };
}
