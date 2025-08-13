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

interface DisputeRequest {
  transferId: string;
  reason: string;
  description?: string;
  evidence?: Record<string, unknown>;
  requestedAction?: 'refund' | 'redelivery' | 'partial_refund';
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
    const body: DisputeRequest = JSON.parse(event.body || '{}');
    const { transferId, reason, description, evidence, requestedAction = 'refund' } = body;

    if (!transferId || !reason) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: transferId, reason' })
      };
    }

    // Find transfer and verify user is either sender or recipient
    const [transferData] = await db.select()
      .from(productTransfers)
      .innerJoin(digitalProducts, eq(productTransfers.productId, digitalProducts.id))
      .leftJoin(ailocks, eq(digitalProducts.ownerAilockId, ailocks.id))
      .where(eq(productTransfers.id, transferId))
      .limit(1);

    if (!transferData) {
      return {
        statusCode: 404,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Transfer not found' })
      };
    }

    const transfer = transferData.product_transfers;
    const product = transferData.digital_products;
    const ownerAilock = transferData.ailocks;

    // Verify user has permission to dispute (either owner or recipient)
    const [userAilock] = await db.select()
      .from(ailocks)
      .where(eq(ailocks.userId, payload.sub))
      .limit(1);

    if (!userAilock) {
      return {
        statusCode: 403,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User ailock not found' })
      };
    }

    const isOwner = ownerAilock?.id === userAilock.id;
    const isRecipient = transfer.toAilockId === userAilock.id;

    if (!isOwner && !isRecipient) {
      return {
        statusCode: 403,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Access denied - not a party to this transfer' })
      };
    }

    // Check if transfer can be disputed
    if (!transfer.status || !['paid', 'delivered', 'acknowledged'].includes(transfer.status)) {
      return {
        statusCode: 403,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Transfer cannot be disputed in current status',
          currentStatus: transfer.status || 'unknown'
        })
      };
    }

    // Check if already disputed
    if (transfer.status === 'disputed') {
      return {
        statusCode: 409,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Transfer is already in dispute',
          currentStatus: transfer.status
        })
      };
    }

    // Check dispute time limits (example: 30 days from delivery)
    const baseDate = transfer.updatedAt || transfer.createdAt || new Date();
    const disputeDeadline = new Date(baseDate);
    disputeDeadline.setDate(disputeDeadline.getDate() + 30);
    
    if (new Date() > disputeDeadline) {
      return {
        statusCode: 403,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Dispute deadline has passed (30 days from last update)',
          deadline: disputeDeadline.toISOString()
        })
      };
    }

    // Update transfer status to disputed
    await db.update(productTransfers)
      .set({ 
        status: 'disputed',
        policy: {
          ...(transfer.policy || {}),
          dispute: {
            reason,
            description,
            evidence,
            requestedAction,
            disputedBy: userAilock.id,
            disputedByRole: isOwner ? 'owner' : 'recipient',
            disputedAt: new Date().toISOString(),
            status: 'open'
          }
        },
        updatedAt: new Date()
      })
      .where(eq(productTransfers.id, transferId));

    console.log('Dispute opened:', {
      transferId,
      productId: product.id,
      reason,
      disputedBy: userAilock.id,
      disputedByRole: isOwner ? 'owner' : 'recipient'
    });

    // TODO: Send product_dispute message via AilockMessageService
    // This would notify the other party about the dispute

    // TODO: Integrate with dispute resolution system
    // This could involve:
    // - Creating a case in an external dispute system
    // - Notifying moderators/administrators
    // - Initiating Stripe dispute process if payment was involved

    return {
      statusCode: 201,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferId,
        productId: product.id,
        productTitle: product.title,
        disputeId: `dispute_${transferId}_${Date.now()}`,
        status: 'disputed',
        reason,
        requestedAction,
        disputedAt: new Date().toISOString(),
        disputedBy: isOwner ? 'owner' : 'recipient',
        message: 'Dispute opened successfully'
      })
    };

  } catch (error) {
    console.error('Products dispute error:', error);
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
