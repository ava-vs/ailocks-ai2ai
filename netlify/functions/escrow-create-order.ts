// English comment: Using type-only imports for types as required by verbatimModuleSyntax.
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import axios from 'axios';
import { escrowClient } from "../../src/lib/services/escrow-client";
import type { GroupOrderPayload } from "../../src/lib/services/escrow-client";

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle preflight requests for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // Ensure the request is a POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    };
  }

  // --- TEMPORARY TEST CODE ---
  let token;
  try {
    const { ESCROW_API_URL, ESCROW_SYSTEM_EMAIL, ESCROW_SYSTEM_PASSWORD, ESCROW_API_KEY } = process.env;

    if (!ESCROW_API_URL || !ESCROW_SYSTEM_EMAIL || !ESCROW_SYSTEM_PASSWORD || !ESCROW_API_KEY) {
      throw new Error('Missing required environment variables for Escrow auth: ESCROW_API_URL, ESCROW_SYSTEM_EMAIL, ESCROW_SYSTEM_PASSWORD, ESCROW_API_KEY');
    }

    // DEBUG: Replicating the exact cURL request from Postman
    console.log('Attempting login by replicating the exact cURL request...');
    const apiUrl = process.env.ESCROW_API_URL + '/auth/login';
    const authResponse = await axios.post(apiUrl, 
      {
        email: ESCROW_SYSTEM_EMAIL,
        password: ESCROW_SYSTEM_PASSWORD
      },
      {
        headers: {
          'Content-Type': 'application/json',
          // This cookie seems to be required by the server's nginx configuration.
          'Cookie': 'refresh_token=14019b3f6063ee4a717682a1a6845b4b78872c4ae5d64d72ca8e998ed700afdc'
        }
      }
    );

    token = authResponse.data.access_token; // Corrected field name based on Postman test
    if (!token) {
      throw new Error('Failed to retrieve access_token from Escrow auth response.');
    }

  } catch (error: any) {
    console.error('Escrow authentication failed:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to authenticate with Escrow API.', details: error.response?.data || error.message }),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    };
  }

  // 2. Use the obtained token to create an order with a hardcoded payload
  const payload: GroupOrderPayload = {
     "customerIds": [
       "c1c6ec67-3ad4-40af-80a8-6d76cdc54036",
       "9afc1ce8-e7d6-4ecf-b098-648b810ea9c9"
     ],
     "title": "Test Author's collection: Australia + Brazil",
     "description": "Test description: Collecting orders for a limited collection. Minimum lot – 200 units.",
     "milestones": [
       {
         "description": "Test description: One-time payment",
         "amount": "4000",
         "deadline": "2025-12-31T23:59:59Z"
       }
     ]
  };

  try {
    const newOrder = await escrowClient.createGroupOrder(payload, token);
    return {
      statusCode: 201,
      body: JSON.stringify(newOrder),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    };
  } catch (error: any) {
    console.error('Escrow API call to create order failed:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create escrow order.', details: error.response?.data || error.message }),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    };
  }
};
