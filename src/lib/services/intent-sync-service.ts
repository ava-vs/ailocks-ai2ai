/**
 * IntentSyncService - сервис для синхронизации интентов между ailocks-ai2ai и escrow-api-1
 * 
 * Обеспечивает:
 * 1. Импорт интентов из escrow-api-1 (PULL)
 * 2. Экспорт интентов в escrow-api-1 (PUSH)
 * 3. Синхронизацию статусов
 * 4. Логирование операций синхронизации
 * 
 * @version 1.0
 * @date 2025-07-12
 */

import { db } from '../db';
import { intents, intentSyncLog, milestones } from '../schema';
import { EscrowClient } from './escrow-client';
import type { GroupOrderPayload, GroupOrderResponse } from './escrow-client';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

// Типы для интеграции
interface SyncResult {
  success: boolean;
  message?: string;
  intentId?: string;
  escrowOrderId?: string;
  error?: any;
}

// Типы для маппинга статусов
const STATUS_MAPPING_ESCROW_TO_AI2AI: Record<string, string> = {
  'CREATED': 'active',
  'APPROVED': 'approved',
  'FUNDED': 'funded',
  'IN_PROGRESS': 'in_progress',
  'COMPLETED': 'completed',
  'CANCELLED': 'cancelled',
};

const STATUS_MAPPING_AI2AI_TO_ESCROW: Record<string, string> = {
  'active': 'CREATED',
  'approved': 'APPROVED',
  'funded': 'FUNDED',
  'in_progress': 'IN_PROGRESS',
  'completed': 'COMPLETED',
  'cancelled': 'CANCELLED'
};

export class IntentSyncService {
  private escrowClient: EscrowClient;
  
  constructor(escrowClient: EscrowClient) {
    this.escrowClient = escrowClient;
  }

  /**
   * Импорт всех интентов из Escrow API
   */
  async pullAllIntentsFromEscrow(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    
    try {
      // Получаем все групповые заказы из Escrow API
      const escrowOrders = await this.escrowClient.getAllGroupOrders();
      logger.info(`Received ${escrowOrders.length} group orders from Escrow API`);
      
      // Обрабатываем каждый заказ
      for (const order of escrowOrders) {
        try {
          const result = await this.importOrderFromEscrow(order);
          results.push(result);
        } catch (error) {
          logger.error(`Failed to import order ${order.id}`, error);
          results.push({
            success: false,
            escrowOrderId: order.id,
            message: `Failed to import: ${(error as Error).message}`,
            error
          });
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Failed to pull intents from Escrow API', error);
      throw new Error(`Could not import intents: ${(error as Error).message}`);
    }
  }

  /**
   * Импорт одного интента из Escrow API
   */
  async importOrderFromEscrow(escrowOrder: GroupOrderResponse): Promise<SyncResult> {
    if (!escrowOrder.id) {
      return {
        success: false,
        message: 'Escrow order ID is missing'
      };
    }
    
    try {
      // Проверяем, существует ли уже интент с таким escrowOrderId
      const existingIntent = await db.query.intents.findFirst({
        where: eq(intents.escrowOrderId, escrowOrder.id)
      });
      
      const operationType = existingIntent ? 'UPDATE' : 'INSERT';
      const intentId = existingIntent ? existingIntent.id : uuidv4();

      const intentData = {
        title: escrowOrder.title || 'Untitled',
        description: escrowOrder.description || '',
        status: escrowOrder.status ? STATUS_MAPPING_ESCROW_TO_AI2AI[escrowOrder.status] || 'active' : 'active',
        totalAmount: String(escrowOrder.totalAmount ?? 0),
        fundedAmount: String(escrowOrder.fundedAmount ?? 0),
        updatedAt: new Date(),
      };

      if (existingIntent) {
        await db.update(intents).set(intentData).where(eq(intents.id, intentId));
        await db.delete(milestones).where(eq(milestones.intentId, intentId));
      } else {
        await db.insert(intents).values({
          ...intentData,
          id: intentId,
          category: 'external',
          origin: 'ESCROW',
          escrowOrderId: escrowOrder.id,
          createdAt: escrowOrder.createdAt ? new Date(escrowOrder.createdAt) : new Date(),
        });
      }

      if (escrowOrder.milestones?.length > 0) {
        const newMilestones = escrowOrder.milestones.map(m => ({
          intentId,
          title: m.description || 'Payment Stage', // Escrow's milestone.description -> our DB's milestone.title
          description: m.description,
          amount: String(m.amount),
          deadline: m.deadline ? new Date(m.deadline) : null,
          status: 'pending',
        }));
        await db.insert(milestones).values(newMilestones);
      }

      await db.insert(intentSyncLog).values({ intentId, direction: 'PULL', status: 'SUCCESS', payload: escrowOrder });
      return {
        success: true,
        intentId,
        escrowOrderId: escrowOrder.id,
        message: `Intent ${operationType.toLowerCase()}d successfully.`,
      };
    } catch (error) {
      logger.error(`Failed to import order ${escrowOrder.id}`, error);
      throw error;
    }
  }

  /**
   * Экспорт интента в Escrow API
   */
  async pushIntentToEscrow(intentId: string, customerIds: string[], userJwt: string): Promise<SyncResult> {
    if (customerIds.length < 2) {
      return {
        success: false,
        intentId,
        message: 'A minimum of 2 customers is required for a group order.'
      };
    }
    
    try {
      // Получаем интент из нашей базы
      const intent = await db.query.intents.findFirst({
        where: eq(intents.id, intentId),
        with: {
          milestones: true
        }
      });
      
      if (!intent) {
        return {
          success: false,
          intentId,
          message: 'Intent not found'
        };
      }
      
      // Проверяем, что интент еще не экспортирован
      if (intent.origin === 'ESCROW' && intent.escrowOrderId) {
        return {
          success: false,
          intentId,
          escrowOrderId: intent.escrowOrderId,
          message: 'Intent is already linked to Escrow order'
        };
      }
      
      // Формируем тело запроса для Escrow API
      const escrowPayload: GroupOrderPayload = {
        customerIds,
        title: intent.title,
        description: intent.description || '',
        milestones: intent.milestones.map(m => ({
          description: m.title,
          amount: String(m.amount), // API требует строку
          deadline: m.deadline?.toISOString(),
        })),
      };

      // Если этапы не указаны, создаем один стандартный этап
      if (escrowPayload.milestones.length === 0) {
        const totalAmount = intent.totalAmount || 100; // Значение по умолчанию, если не указано
        
        escrowPayload.milestones = [{
          description: 'Единовременный платёж',
          amount: String(totalAmount),
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 дней от сегодня
        }];
      }
      
      // Отправляем запрос в Escrow API
      const createdOrder = await this.escrowClient.createGroupOrder(escrowPayload, userJwt);
      
      // Обновляем интент в нашей базе
      await db.update(intents)
        .set({
          origin: 'ESCROW',
          escrowOrderId: createdOrder.id,
          totalAmount: String(createdOrder.totalAmount ?? 0),
          fundedAmount: String(createdOrder.fundedAmount ?? 0),
          status: createdOrder.status ? STATUS_MAPPING_ESCROW_TO_AI2AI[createdOrder.status] || 'active' : 'active',
          updatedAt: new Date()
        })
        .where(eq(intents.id, intentId));
      
      // Логируем успешную операцию
      await db.insert(intentSyncLog)
        .values({
          intentId,
          direction: 'PUSH',
          status: 'SUCCESS',
          payload: createdOrder
        });
      
      return {
        success: true,
        intentId,
        escrowOrderId: createdOrder.id,
        message: 'Intent exported to Escrow successfully'
      };
    } catch (error) {
      // Логируем ошибку
      await db.insert(intentSyncLog)
        .values({
          intentId,
          direction: 'PUSH',
          status: 'FAIL',
          error: (error as Error).message
        });
      
      logger.error(`Failed to push intent ${intentId} to Escrow API`, error);
      return {
        success: false,
        intentId,
        message: `Failed to export intent: ${(error as Error).message}`,
        error
      };
    }
  }

  /**
   * Синхронизация статусов интента с Escrow API
   */
  async syncIntentStatus(intentId: string): Promise<SyncResult> {
    try {
      // Получаем интент из нашей базы
      const intent = await db.query.intents.findFirst({
        where: eq(intents.id, intentId)
      });
      
      if (!intent || intent.origin !== 'ESCROW' || !intent.escrowOrderId) {
        return {
          success: false,
          intentId,
          message: 'Intent is not linked to Escrow'
        };
      }
      
      // Получаем актуальную информацию из Escrow API
      const escrowOrder = await this.escrowClient.getGroupOrderById(intent.escrowOrderId);
      
      // Обновляем статус и суммы
      await db.update(intents)
        .set({
          status: escrowOrder.status ? STATUS_MAPPING_ESCROW_TO_AI2AI[escrowOrder.status] || intent.status : intent.status,
          totalAmount: String(escrowOrder.totalAmount ?? 0),
          fundedAmount: String(escrowOrder.fundedAmount ?? 0),
          updatedAt: new Date()
        })
        .where(eq(intents.id, intentId));
      
      // Логируем операцию
      await db.insert(intentSyncLog)
        .values({
          intentId,
          direction: 'PULL',
          status: 'SUCCESS',
          payload: escrowOrder
        });
      
      return {
        success: true,
        intentId,
        escrowOrderId: intent.escrowOrderId,
        message: 'Intent status synchronized successfully'
      };
    } catch (error) {
      // Логируем ошибку
      await db.insert(intentSyncLog)
        .values({
          intentId,
          direction: 'PULL',
          status: 'FAIL',
          error: (error as Error).message
        });
      
      logger.error(`Failed to sync intent status for ${intentId}`, error);
      return {
        success: false,
        intentId,
        message: `Failed to sync status: ${(error as Error).message}`,
        error
      };
    }
  }

  /**
   * Получение списка интентов, требующих синхронизации статуса
   */
  async getIntentsForStatusSync(maxAge: number = 24): Promise<string[]> {
    // Выбираем интенты из Escrow, которые не обновлялись в течение заданного времени
    const cutoffDate = new Date(Date.now() - maxAge * 60 * 60 * 1000); // maxAge в часах
    
    const intentsToSync = await db.query.intents.findMany({
      where: and(
        eq(intents.origin, 'ESCROW'),
        eq(isNull(intents.escrowOrderId), false) // Ищем не нулевые escrowOrderId
        // Убрана проверка по дате из-за несовместимости типов
      ),
      columns: {
        id: true
      }
    });
    
    return intentsToSync.map(intent => intent.id);
  }

  /**
   * Групповая синхронизация статусов интентов
   */
  async syncAllStatuses(maxAge: number = 24): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    
    try {
      // Получаем список интентов для синхронизации
      const intentsToSync = await this.getIntentsForStatusSync(maxAge);
      logger.info(`Found ${intentsToSync.length} intents for status sync`);
      
      // Обрабатываем каждый интент
      for (const intentId of intentsToSync) {
        try {
          const result = await this.syncIntentStatus(intentId);
          results.push(result);
        } catch (error) {
          logger.error(`Failed to sync intent ${intentId}`, error);
          results.push({
            success: false,
            intentId,
            message: `Failed to sync: ${(error as Error).message}`,
            error
          });
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Failed to sync intents statuses', error);
      throw new Error(`Не удалось синхронизировать статусы интентов: ${(error as Error).message}`);
    }
  }
}

export default IntentSyncService;
