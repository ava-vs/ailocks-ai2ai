/**
 * EscrowClient - сервисный класс для взаимодействия с escrow-api-1
 * 
 * Обеспечивает:
 * 1. Авторизацию через JWT и API-Key
 * 2. Получение интентов (group-orders)
 * 3. Создание новых интентов
 * 4. Синхронизацию статусов
 * 
 * @version 1.0
 * @date 2025-07-12
 */

import axios, { type AxiosInstance } from 'axios';

// Interfaces for Escrow API interaction.
// These types define the shape of data sent to and received from the Escrow API.

export interface EscrowMilestonePayload {
  description: string;
  amount: string; // Amount must be a string as per API requirements.
  deadline?: string; // Optional deadline in ISO format.
}

export interface GroupOrderPayload {
  title: string;
  description: string;
  customerIds: string[]; // UUIDs of users in the Escrow system.
  milestones: EscrowMilestonePayload[];
}

export interface EscrowMilestoneResponse {
  id: string;
  description: string;
  amount: number;
  status: string;
  deadline?: string;
}

export interface GroupOrderResponse {
  id: string; // The unique identifier for the created escrow order.
  title: string;
  description: string;
  status: string;
  totalAmount: number;
  fundedAmount: number;
  createdAt: string;
  milestones: EscrowMilestoneResponse[];
}

/**
 * Client for interacting with the Escrow-API-1.
 * This class encapsulates all logic for making HTTP requests to the Escrow API,
 * including authentication which is handled via an API key and a user-specific JWT.
 */
export class EscrowClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;

  constructor() {
    // API URL and Key must be stored in environment variables for security.
    const apiUrl = process.env.ESCROW_API_URL;
    const apiKey = process.env.ESCROW_API_KEY;

    if (!apiUrl || !apiKey) {
      throw new Error('ESCROW_API_URL and ESCROW_API_KEY must be set in environment variables.');
    }

    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      baseURL: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey, // API key is static for all requests
      },
      timeout: 10000, // 10-second timeout for requests
    });
  }

  /**
   * Creates a new group order in the escrow system.
   * @param payload - The data for the new group order.
   * @param userJwt - The JWT of the user initiating the creation for authorization.
   * @returns The created group order details.
   */
  async createGroupOrder(payload: GroupOrderPayload, userJwt: string): Promise<GroupOrderResponse> {
    try {
      const response = await this.axiosInstance.post<GroupOrderResponse>('/api/group-orders', payload, {
        headers: {
          'Authorization': `Bearer ${userJwt}`,
          'X-API-Key': this.apiKey, // Add API key header as per docs
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to create escrow group order:', error.response?.data || error.message);
      throw new Error('Escrow API request to create group order failed.');
    }
  }

  /**
   * Retrieves a single group order by its ID.
   * @param orderId - The unique identifier of the group order.
   * @returns The group order details.
   */
  async getGroupOrderById(orderId: string): Promise<GroupOrderResponse> {
    try {
      const response = await this.axiosInstance.get<GroupOrderResponse>(`/api/group-orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get escrow group order ${orderId}:`, error);
      throw new Error('Escrow API request to get group order by ID failed.');
    }
  }

  /**
   * Retrieves all group orders.
   * Note: This assumes the API doesn't require a user-specific JWT for this action.
   * @returns A list of all group orders.
   */
  async getAllGroupOrders(): Promise<GroupOrderResponse[]> {
    try {
      const response = await this.axiosInstance.get<GroupOrderResponse[]>('/api/group-orders');
      return response.data;
    } catch (error) {
      console.error('Failed to get all escrow group orders:', error);
      throw new Error('Escrow API request to get all group orders failed.');
    }
  }
}

// Export a singleton instance of the client.
// This ensures that only one instance of the client is used throughout the application,
// which is efficient and prevents issues with multiple instances.
export const escrowClient = new EscrowClient();

export default EscrowClient;
