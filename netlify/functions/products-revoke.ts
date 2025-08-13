import type { Handler } from '@netlify/functions';
import jwt from 'jsonwebtoken';
import { db } from '../../src/lib/db';
import { productTransfers, productKeys, digitalProducts, ailocks } from '../../src/lib/schema';
import { eq, and } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface RevokeRequest {
  transferId: string;
  reason?: string;
  policy?: Record<string, unknown>;
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

    let payload: { sub: string };
    try {
      payload = jwt.verify(token, jwtSecret) as { sub: string };
    } catch (error) {
      return {
        statusCode: 401,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    // Parse request body
    const body: RevokeRequest = JSON.parse(event.body || '{}');
    const { transferId, reason, policy } = body;

    if (!transferId) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required field: transferId' })
      };
    }

    // Find transfer and verify ownership
    const [transferData] = await db.select()
      .from(productTransfers)
      .innerJoin(digitalProducts, eq(productTransfers.productId, digitalProducts.id))
      .innerJoin(ailocks, eq(digitalProducts.ownerAilockId, ailocks.id))
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

    // Check if transfer can be revoked
    if (!transfer.status || !['delivered', 'acknowledged'].includes(transfer.status)) {
      return {
        statusCode: 403,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Transfer cannot be revoked in current status',
          currentStatus: transfer.status || 'unknown'
        })
      };
    }

    // Check policy-based revocation rules
    const transferPolicy = (transfer.policy || {}) as Record<string, unknown>;
    const revocationPolicy = policy || {};
    
    // Example policy checks (can be extended)
    if (transferPolicy.noRevocation === true) {
      return {
        statusCode: 403,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Transfer policy does not allow revocation' })
      };
    }

    // Check time-based revocation limits
    if (transferPolicy.revocationDeadline) {
      try {
        const deadlineValue = transferPolicy.revocationDeadline as string | number | Date;
        const deadline = new Date(deadlineValue);
        if (new Date() > deadline) {
          return {
            statusCode: 403,
            headers: { ...headersBase, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Revocation deadline has passed' })
          };
        }
      } catch (error) {
        console.warn('Invalid revocation deadline format:', transferPolicy.revocationDeadline);
      }
    }

    // Expire associated key envelopes
    await db.update(productKeys)
      .set({ 
        expiresAt: new Date(), // Expire immediately
      })
      .where(and(
        eq(productKeys.productId, product.id),
        eq(productKeys.recipientAilockId, transfer.toAilockId)
      ));

    // Update transfer status to refunded (or create a new status for revoked)
    await db.update(productTransfers)
      .set({ 
        status: 'refunded', // Using existing enum value
        policy: {
          ...(transfer.policy || {}),
          revoked: true,
          revokedAt: new Date().toISOString(),
          revokedReason: reason || 'Manual revocation',
          revokedBy: payload.sub,
          ...revocationPolicy
        },
        updatedAt: new Date()
      })
      .where(eq(productTransfers.id, transferId));

    console.log('Product access revoked:', {
      transferId,
      productId: product.id,
      reason: reason || 'Manual revocation',
      revokedBy: payload.sub
    });

    // TODO: Send product_revoke message via AilockMessageService
    // This would notify the recipient that access has been revoked

    // TODO: Initiate refund process via Stripe API if payment was made
    // This would depend on the refund policy and payment provider integration

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId,
        productId: product.id,
        productTitle: product.title,
        status: 'revoked',
        reason: reason || 'Manual revocation',
        revokedAt: new Date().toISOString(),
        message: 'Product access revoked successfully'
      })
    };

  } catch (error) {
    console.error('Products revoke error:', error);
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
