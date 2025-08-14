import type { Handler } from '@netlify/functions';
// import jwt from 'jsonwebtoken';
import { db } from '../../src/lib/db';
import { digitalProducts } from '../../src/lib/schema';
import { eq } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    console.error('Products requirements error:', error);
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
  const productId = event.queryStringParameters?.productId;
  
  if (!productId) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'productId parameter is required' })
    };
  }

  // Return mock required inputs for testing
  const mockRequiredInputs = [
    {
      name: 'buyer_email',
      type: 'text',
      timing: 'pre_payment',
      required: true,
      description: 'Email address for delivery notifications'
    },
    {
      name: 'company_document',
      type: 'file',
      timing: 'pre_payment',
      required: true,
      description: 'Company registration document (PDF)'
    },
    {
      name: 'usage_description',
      type: 'text',
      timing: 'post_payment_pre_grant',
      required: false,
      description: 'Brief description of intended usage'
    }
  ];

  console.log('Mock products-requirements called for productId:', productId);

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId,
      requiredInputs: mockRequiredInputs,
      message: 'Mock required inputs returned (test mode)'
    })
  };
}

// Real implementation with database
async function handleRealRequest(event: any) {
  const productId = event.queryStringParameters?.productId;
  
  if (!productId) {
    return {
      statusCode: 400,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'productId parameter is required' })
    };
  }

  // Find the product
  const [product] = await db.select({
    id: digitalProducts.id,
    title: digitalProducts.title,
    requiredInputs: digitalProducts.requiredInputs
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

  // Extract required inputs from product
  const requiredInputs = product.requiredInputs || [];

  console.log('Products requirements retrieved for product:', productId);

  return {
    statusCode: 200,
    headers: { ...headersBase, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId,
      requiredInputs,
      message: 'Required inputs retrieved successfully'
    })
  };
}
