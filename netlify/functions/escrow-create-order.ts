// English comment: Using type-only imports for types as required by verbatimModuleSyntax.
import type { Handler, HandlerEvent } from "@netlify/functions";
import axios from 'axios';
import { EscrowClient } from "../../src/lib/services/escrow-client";
import type { GroupOrderPayload, OrderPayload } from "../../src/lib/services/escrow-client";
import { db } from '../../src/lib/db';
import { users, escrowUserLinks } from '../../src/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * English comment: Helper function to create a standardized JSON response with CORS headers.
 * @param statusCode - The HTTP status code.
 * @param body - The response body, which will be automatically stringified.
 * @returns A Netlify handler response object.
 */
const jsonResp = (statusCode: number, body: object) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // Allow requests from any origin
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Basic validation
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }), headers: { ...corsHeaders, 'Content-Type': 'application/json' } };
  }
  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing request body' }), headers: { ...corsHeaders, 'Content-Type': 'application/json' } };
  }

  try {
    // 1. Parse incoming data
    const { title, description, customerIds, milestones, recipient_email } = JSON.parse(event.body);

    if (!title || !description || !customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return jsonResp(400, { error: 'Missing required fields: title, description, and customerIds are required.' });
    }

    let finalCustomerIds = [...customerIds];

    if (recipient_email) {
      // Find recipient user by email
      const recipientUserRes = await db.select({ id: users.id }).from(users).where(eq(users.email, recipient_email)).limit(1);
      if (recipientUserRes.length === 0) {
        return jsonResp(404, { error: `Recipient user with email ${recipient_email} not found.` });
      }
      const recipientUserId = recipientUserRes[0].id;

      // Find recipient's escrow user id
      const recipientEscrowLinkRes = await db.select({ escrowUserId: escrowUserLinks.escrowUserId }).from(escrowUserLinks).where(eq(escrowUserLinks.ai2aiUserId, recipientUserId)).limit(1);
      if (recipientEscrowLinkRes.length === 0) {
        return jsonResp(404, { error: `Escrow user link not found for recipient ${recipient_email}.` });
      }
      const recipientEscrowId = recipientEscrowLinkRes[0].escrowUserId;

      // Combine creator's and recipient's escrow IDs
      finalCustomerIds = [...new Set([...finalCustomerIds, recipientEscrowId])];
    }

    // 2. Authenticate with Escrow API to get a token
    const { ESCROW_API_URL, ESCROW_SYSTEM_EMAIL, ESCROW_SYSTEM_PASSWORD } = process.env;
    if (!ESCROW_API_URL || !ESCROW_SYSTEM_EMAIL || !ESCROW_SYSTEM_PASSWORD) {
      throw new Error('Missing required environment variables for Escrow authentication.');
    }

    const apiUrl = ESCROW_API_URL + '/auth/login';
    const authResponse = await axios.post(apiUrl, 
      { email: ESCROW_SYSTEM_EMAIL, password: ESCROW_SYSTEM_PASSWORD },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'refresh_token=14019b3f6063ee4a717682a1a6845b4b78872c4ae5d64d72ca8e998ed700afdc' // Required by nginx
        }
      }
    );

    const token = authResponse.data.access_token;
    if (!token) {
      throw new Error('Failed to retrieve access_token from Escrow auth response.');
    }

    // 3. Construct the payload for the Escrow API and choose appropriate endpoint
    const escrowClient = new EscrowClient();
    let newOrder;
    
    if (finalCustomerIds.length === 1) {
      // Use regular order API for single customer
      const payload: OrderPayload = {
        title,
        description,
        customerId: finalCustomerIds[0],
        milestones: milestones || [], // Use provided milestones or default to an empty array
      };
      
      console.log('Escrow Create Order Payload (Single Customer):', payload);
      newOrder = await escrowClient.createOrder(payload, token);
    } else {
      // Use group order API for multiple customers
      const payload: GroupOrderPayload = {
        title,
        description,
        customerIds: finalCustomerIds,
        milestones: milestones || [], // Use provided milestones or default to an empty array
      };
      
      console.log('Escrow Create Group Order Payload (Multiple Customers):', payload);
      newOrder = await escrowClient.createGroupOrder(payload, token);
    }

    // 5. Return the successful response
    return {
      statusCode: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder),
    };

  } catch (error: any) {
    console.error('Failed to process escrow order creation:', error.response?.data || error.message);
    return {
      statusCode: error.response?.status || 500,
      body: JSON.stringify({ 
        error: 'Failed to create escrow group order.', 
        details: error.response?.data || error.message 
      }),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    };
  }
};
