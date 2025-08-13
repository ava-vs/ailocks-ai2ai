import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { paymentIntents, productTransfers } from '../../src/lib/schema';
import { eq } from 'drizzle-orm';

const headersBase = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

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
    const body = event.body;
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

    if (!body) {
      return {
        statusCode: 400,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    // For testing without Stripe webhook endpoint secret
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.log('Processing webhook without signature verification (test mode)');
      
      // Parse the webhook payload
      let event_data: any;
      try {
        event_data = JSON.parse(body);
      } catch (error) {
        return {
          statusCode: 400,
          headers: { ...headersBase, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid JSON payload' })
        };
      }

      // Handle test webhook events
      if (event_data.type === 'checkout.session.completed' || event_data.type === 'payment_intent.succeeded') {
        const transferId = event_data.data?.object?.metadata?.transferId || 
                          event_data.data?.object?.client_reference_id;
        
        if (transferId) {
          await processPaymentSuccess(transferId, event_data.data.object.id);
        }
      }

      return {
        statusCode: 200,
        headers: { ...headersBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true })
      };
    }

    // TODO: Implement real Stripe webhook signature verification
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // 
    // let event;
    // try {
    //   event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    // } catch (err) {
    //   console.log('Webhook signature verification failed:', err.message);
    //   return {
    //     statusCode: 400,
    //     headers: { ...headersBase, 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ error: 'Webhook signature verification failed' })
    //   };
    // }
    //
    // Handle the event
    // switch (event.type) {
    //   case 'checkout.session.completed':
    //   case 'payment_intent.succeeded':
    //     const transferId = event.data.object.metadata?.transferId || 
    //                       event.data.object.client_reference_id;
    //     if (transferId) {
    //       await processPaymentSuccess(transferId, event.data.object.id);
    //     }
    //     break;
    //   case 'payment_intent.payment_failed':
    //     // Handle failed payment
    //     break;
    //   default:
    //     console.log(`Unhandled event type ${event.type}`);
    // }

    return {
      statusCode: 200,
      headers: { ...headersBase, 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Stripe webhook error:', error);
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

async function processPaymentSuccess(transferId: string, paymentId: string): Promise<void> {
  try {
    console.log('Processing payment success:', { transferId, paymentId });

    // Update payment intent status
    await db.update(paymentIntents)
      .set({ 
        status: 'paid',
        providerRef: paymentId
      })
      .where(eq(paymentIntents.transferId, transferId));

    // Update transfer status to paid
    await db.update(productTransfers)
      .set({ 
        status: 'paid',
        updatedAt: new Date()
      })
      .where(eq(productTransfers.id, transferId));

    console.log('Payment processed successfully:', transferId);

    // TODO: Send payment_confirmed message via AilockMessageService
    // This would notify both parties that payment was successful

  } catch (error) {
    console.error('Error processing payment success:', error);
    throw error;
  }
}
