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

import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import type { IAxiosRetryConfig } from 'axios-retry';
import { logger } from '../logger'; // Предполагается, что в проекте есть логгер

// Тип для приведения AxiosInstance к AxiosStatic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AxiosStaticLike = any; // Используем any для обхода проблем с типами

// Типы для интеграции с Escrow API
export interface EscrowMilestone {
  id?: string;
  description: string;
  amount: string; // Строка, как требует API
  deadline: string; // ISO формат даты
}

export interface EscrowGroupOrder {
  id?: string;
  customerIds: string[];
  title: string;
  description: string;
  milestones: EscrowMilestone[];
  status?: string;
  totalAmount?: string;
  fundedAmount?: string;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface EscrowClientConfig {
  baseUrl: string;
  apiKey: string;
  authServiceUrl?: string;
}

export class EscrowClient {
  private client: AxiosInstance;
  private authClient: AxiosInstance | null = null;
  private apiKey: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private authServiceUrl: string | null = null;
  
  constructor(config: EscrowClientConfig) {
    this.apiKey = config.apiKey;
    
    // Настройка основного клиента для Escrow API
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 10000, // 10 секунд таймаут
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    });
    
    // Настройка повторов запросов при ошибках
    const retryOptions: IAxiosRetryConfig = {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // Повторяем только при проблемах сети или 5XX ошибках сервера
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               !!(error.response && error.response.status >= 500);
      }
    };
    
    // Применяем настройки повторов к клиенту с приведением типа
    axiosRetry(this.client as AxiosStaticLike, retryOptions);
    
    // Настройка клиента для Auth Service, если URL предоставлен
    if (config.authServiceUrl) {
      this.authServiceUrl = config.authServiceUrl;
      this.authClient = axios.create({
        baseURL: config.authServiceUrl,
        timeout: 5000
      });
      
      const authRetryOptions: IAxiosRetryConfig = {
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay
      };
      
      // Применяем настройки повторов к клиенту аутентификации с приведением типа
      if (this.authClient) {
        axiosRetry(this.authClient as AxiosStaticLike, authRetryOptions);
      }
    }
    
    // Добавление перехватчика для обработки ошибок аутентификации
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Если ошибка 401 (Unauthorized) и запрос не повторялся ранее
        if (error.response?.status === 401 && !originalRequest._retry && this.authClient) {
          originalRequest._retry = true;
          
          try {
            // Обновляем токен
            await this.refreshAuthToken();
            
            // Повторяем исходный запрос с новым токеном
            originalRequest.headers['Authorization'] = `Bearer ${this.accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            logger.error('Failed to refresh authentication token', refreshError);
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Авторизация через Auth Service
   */
  async authenticate(email: string, password: string): Promise<boolean> {
    if (!this.authClient) {
      throw new Error('Auth Service URL не настроен');
    }
    
    try {
      const response = await this.authClient.post<AuthResponse>('/api/auth/login', {
        email,
        password
      });
      
      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken || null;
      
      // Устанавливаем время истечения токена
      if (response.data.expiresIn) {
        this.tokenExpiry = Date.now() + response.data.expiresIn * 1000;
      }
      
      return true;
    } catch (error) {
      logger.error('Authentication failed', error);
      return false;
    }
  }
  
  /**
   * Обновление токена авторизации
   */
  private async refreshAuthToken(): Promise<void> {
    if (!this.authClient || !this.refreshToken) {
      throw new Error('Refresh token или Auth Service не настроены');
    }
    
    const response = await this.authClient.post<AuthResponse>('/api/auth/refresh', {
      refreshToken: this.refreshToken
    });
    
    this.accessToken = response.data.accessToken;
    this.refreshToken = response.data.refreshToken || this.refreshToken;
    
    if (response.data.expiresIn) {
      this.tokenExpiry = Date.now() + response.data.expiresIn * 1000;
    }
  }
  
  /**
   * Проверка срока действия токена и его обновление при необходимости
   */
  private async ensureValidToken(): Promise<void> {
    // Если токен отсутствует или истек
    if (!this.accessToken || (this.tokenExpiry && Date.now() >= this.tokenExpiry - 60000)) {
      // 60000 мс = 1 минута (обновляем за минуту до истечения)
      await this.refreshAuthToken();
    }
  }
  
  /**
   * Получение базовых заголовков для запросов
   */
  private async getRequestHeaders(): Promise<Record<string, string>> {
    // Убедимся, что токен действителен
    if (this.accessToken) {
      try {
        await this.ensureValidToken();
      } catch (error) {
        logger.warn('Failed to refresh token, continuing with existing credentials', error);
      }
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey
    };
    
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    return headers;
  }
  
  /**
   * Получение списка всех групповых заказов
   */
  async getAllGroupOrders(): Promise<EscrowGroupOrder[]> {
    try {
      const headers = await this.getRequestHeaders();
      const response = await this.client.get<EscrowGroupOrder[]>('/api/group-orders', { headers });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch all group orders', error);
      throw new Error('Не удалось получить список групповых заказов');
    }
  }
  
  /**
   * Получение групповых заказов по ID клиента
   */
  async getCustomerGroupOrders(customerId: string): Promise<EscrowGroupOrder[]> {
    try {
      const headers = await this.getRequestHeaders();
      const response = await this.client.get<EscrowGroupOrder[]>(`/api/group-orders?customerId=${customerId}`, { headers });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch group orders for customer ${customerId}`, error);
      throw new Error(`Не удалось получить групповые заказы для клиента ${customerId}`);
    }
  }
  
  /**
   * Получение группового заказа по ID
   */
  async getGroupOrderById(orderId: string): Promise<EscrowGroupOrder> {
    try {
      const headers = await this.getRequestHeaders();
      const response = await this.client.get<EscrowGroupOrder>(`/api/group-orders/${orderId}`, { headers });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch group order with id ${orderId}`, error);
      throw new Error(`Не удалось получить групповой заказ ${orderId}`);
    }
  }
  
  /**
   * Создание нового группового заказа
   */
  async createGroupOrder(groupOrder: EscrowGroupOrder): Promise<EscrowGroupOrder> {
    try {
      const headers = await this.getRequestHeaders();
      
      // Важно: убедимся, что amount передается строкой, как требует API
      const payload = {
        ...groupOrder,
        milestones: groupOrder.milestones.map(milestone => ({
          ...milestone,
          amount: String(milestone.amount)
        }))
      };
      
      // Удаляем все символы \r перед отправкой (проблема Windows)
      const cleanPayload = JSON.stringify(payload).replace(/\\r/g, '');
      
      const response = await this.client.post<EscrowGroupOrder>(
        '/api/group-orders', 
        JSON.parse(cleanPayload), 
        { headers }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create group order', { 
        error: error?.message,
        response: error?.response?.data 
      });
      
      throw new Error(`Не удалось создать групповой заказ: ${error?.response?.data?.error || error?.message || 'неизвестная ошибка'}`);
    }
  }
  
  /**
   * Установка JWT токена напрямую (если получен из другого источника)
   */
  setAccessToken(token: string, expiresIn?: number): void {
    this.accessToken = token;
    
    if (expiresIn) {
      this.tokenExpiry = Date.now() + expiresIn * 1000;
    } else {
      this.tokenExpiry = null;
    }
  }
}

export default EscrowClient;
