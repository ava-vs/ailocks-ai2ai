// English comment: Using type-only imports for types as required by verbatimModuleSyntax.
import type { Handler, HandlerEvent } from "@netlify/functions";
import axios from 'axios';
import { EscrowClient } from "../../src/lib/services/escrow-client";
import type { GroupOrderPayload } from "../../src/lib/services/escrow-client";
import { db } from '../../src/lib/db';
import { users, escrowUserLinks } from '../../src/lib/schema';
import { eq } from 'drizzle-orm';
// Импортируем функцию для добавления заказа в хранилище
import { addCreatedOrder } from './escrow-get-user-orders';

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

    // ВРЕМЕННОЕ РЕШЕНИЕ: Возвращаем мок-ответ для тестирования интерфейса
    // Генерируем уникальный ID для заказа
    const orderId = 'mock-' + Date.now().toString();
    
    // Создаем фиктивный ответ на основе полученных данных
    const mockOrder = {
      id: orderId,
      title: title,
      description: description,
      status: 'created',
      progress: 0,
      amount: milestones?.reduce((sum: number, m: any) => sum + (parseFloat(m.amount) || 0), 0) || 0,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      customerIds: customerIds,
      milestones: milestones?.map((m: any, index: number) => ({
        id: `milestone-${index}-${orderId}`,
        description: m.description,
        amount: parseFloat(m.amount) || 0,
        deadline: m.deadline || new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      })) || []
    };

    console.log('Создан мок-заказ для тестирования:', mockOrder);
    
    // Добавляем созданный заказ в хранилище для отображения в списке заказов
    addCreatedOrder(mockOrder);
    
    // Возвращаем успешный ответ с мок-данными
    return {
      statusCode: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(mockOrder),
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
