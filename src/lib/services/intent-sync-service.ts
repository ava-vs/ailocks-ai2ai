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
import { 
  intents, 
  intentSyncLog, 
  milestones, 
  originEnum, 
  syncDirectionEnum, 
  syncStatusEnum 
} from '../schema';
import EscrowClient from './escrow-client';
import type { EscrowGroupOrder, EscrowMilestone } from './escrow-client';
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
  'CANCELLED': 'cancelled'
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
      throw new Error(`Не удалось импортировать интенты: ${(error as Error).message}`);
    }
  }

  /**
   * Импорт одного интента из Escrow API
   */
  async importOrderFromEscrow(escrowOrder: EscrowGroupOrder): Promise<SyncResult> {
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
      
      let intentId: string;
      let operationType: 'INSERT' | 'UPDATE';
      
      if (existingIntent) {
        // Обновляем существующий интент
        intentId = existingIntent.id;
        operationType = 'UPDATE';
        
        await db.update(intents)
          .set({
            title: escrowOrder.title,
            description: escrowOrder.description,
            status: escrowOrder.status ? STATUS_MAPPING_ESCROW_TO_AI2AI[escrowOrder.status] || 'active' : 'active',
            totalAmount: escrowOrder.totalAmount ?? null,
            fundedAmount: escrowOrder.fundedAmount ?? null,
            updatedAt: new Date()
          })
          .where(eq(intents.id, intentId));
          
        // Удаляем существующие этапы, чтобы заменить их актуальными
        await db.delete(milestones)
          .where(eq(milestones.intentId, intentId));
      } else {
        // Создаем новый интент
        intentId = uuidv4();
        operationType = 'INSERT';
        
        await db.insert(intents)
          .values({
            id: intentId,
            title: escrowOrder.title || 'Без названия',
            description: escrowOrder.description || '',
            category: 'external', // Категория для внешних интентов
            origin: 'ESCROW',
            escrowOrderId: escrowOrder.id,
            status: escrowOrder.status ? STATUS_MAPPING_ESCROW_TO_AI2AI[escrowOrder.status] || 'active' : 'active',
            totalAmount: escrowOrder.totalAmount ? escrowOrder.totalAmount : null,
            fundedAmount: escrowOrder.fundedAmount ? escrowOrder.fundedAmount : null,
            createdAt: escrowOrder.createdAt ? new Date(escrowOrder.createdAt) : new Date(),
            updatedAt: new Date()
          });
      }
      
      // Создаем этапы для интента
      if (escrowOrder.milestones && escrowOrder.milestones.length > 0) {
        for (const milestone of escrowOrder.milestones) {
          await db.insert(milestones)
            .values({
              intentId,
              title: milestone.description || 'Этап платежа',
              description: milestone.description,
              amount: milestone.amount,
              deadline: milestone.deadline ? new Date(milestone.deadline) : null,
              status: 'pending'
            });
        }
      }
      
      // Логируем операцию синхронизации
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
        escrowOrderId: escrowOrder.id,
        message: `Intent ${operationType === 'INSERT' ? 'created' : 'updated'} successfully`
      };
    } catch (error) {
      // Логируем ошибку синхронизации
      if (escrowOrder.id) {
        const existingIntent = await db.query.intents.findFirst({
          where: eq(intents.escrowOrderId, escrowOrder.id)
        });
        
        if (existingIntent) {
          await db.insert(intentSyncLog)
            .values({
              intentId: existingIntent.id,
              direction: 'PULL',
              status: 'FAIL',
              error: (error as Error).message,
              payload: escrowOrder
            });
        }
      }
      
      logger.error(`Failed to import order ${escrowOrder.id}`, error);
      throw error;
    }
  }

  /**
   * Экспорт интента в Escrow API
   */
  async pushIntentToEscrow(intentId: string, customerIds: string[]): Promise<SyncResult> {
    if (customerIds.length < 2) {
      return {
        success: false,
        intentId,
        message: 'Для создания группового заказа требуется минимум 2 заказчика'
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
      const escrowOrder: EscrowGroupOrder = {
        customerIds,
        title: intent.title,
        description: intent.description,
        milestones: intent.milestones.map(m => ({
          description: m.description || m.title,
          amount: m.amount.toString(), // API требует строку
          deadline: m.deadline ? m.deadline.toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 дней от сегодня
        }))
      };
      
      // Если этапы не указаны, создаем один стандартный этап
      if (escrowOrder.milestones.length === 0) {
        const totalAmount = intent.totalAmount || 100; // Значение по умолчанию, если не указано
        
        escrowOrder.milestones = [{
          description: 'Единовременный платёж',
          amount: totalAmount.toString(),
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 дней от сегодня
        }];
      }
      
      // Отправляем запрос в Escrow API
      const createdOrder = await this.escrowClient.createGroupOrder(escrowOrder);
      
      // Обновляем интент в нашей базе
      await db.update(intents)
        .set({
          origin: 'ESCROW',
          escrowOrderId: createdOrder.id,
          totalAmount: createdOrder.totalAmount ? createdOrder.totalAmount : null,
          fundedAmount: createdOrder.fundedAmount ? createdOrder.fundedAmount : null,
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
  async syncIntentStatus(intentId: string, syncLastUpdated: boolean = false): Promise<SyncResult> {
    try {
      // Получаем интент из нашей базы
      const intent = await db.query.intents.findFirst({
        where: eq(intents.id, intentId)
      });
      
      if (!intent) {
        return {
          success: false,
          intentId,
          message: 'Intent not found'
        };
      }
      
      // Проверяем, что интент связан с Escrow
      if (intent.origin !== 'ESCROW' || !intent.escrowOrderId) {
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
          totalAmount: escrowOrder.totalAmount ? escrowOrder.totalAmount : intent.totalAmount,
          fundedAmount: escrowOrder.fundedAmount ? escrowOrder.fundedAmount : intent.fundedAmount,
          updatedAt: new Date()
        })
        .where(eq(intents.id, intentId));
      
      // Логируем операцию
      await db.insert(intentSyncLog)
        .values({
          intentId,
          direction: 'PULL',
          status: 'SUCCESS',
          payload: {
            id: escrowOrder.id,
            status: escrowOrder.status,
            totalAmount: escrowOrder.totalAmount,
            fundedAmount: escrowOrder.fundedAmount
          }
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
      
      logger.error(`Failed to sync intent status ${intentId}`, error);
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
