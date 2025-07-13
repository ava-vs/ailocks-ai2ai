/**
 * Notification Service - управление уведомлениями системы
 * Обеспечивает функциональность создания, чтения и обновления уведомлений
 * для поддержки реального времени и бейджей в UI
 */

import { db, withDbRetry } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Типы для моделей данных уведомлений
export interface Notification {
  id: string;
  user_id: string;
  type: 'message' | 'invite' | 'intent';
  title: string;
  message: string;
  group_id?: string;
  sender_id?: string;
  read: boolean;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

// Класс сервиса для работы с уведомлениями
export class NotificationService {
  // Создание нового уведомления
  async createNotification(
    userId: string,
    type: 'message' | 'invite' | 'intent',
    title: string,
    message: string,
    groupId?: string,
    senderId?: string
  ): Promise<Notification> {
    const id = uuidv4();
    const now = new Date();
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        INSERT INTO "notifications" (
          "id", "user_id", "type", "title", "message", 
          "group_id", "sender_id", "read", "created_at", "updated_at"
        ) 
        VALUES (
          ${id}, ${userId}, ${type}, ${title}, ${message}, 
          ${groupId || null}, ${senderId || null}, false, ${now}, ${now}
        )
        RETURNING *
      `);
      return result.rows[0] as Notification;
    });
  }

  // Получение всех уведомлений пользователя
  async getUserNotifications(userId: string): Promise<Notification[]> {
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        SELECT * FROM "notifications"
        WHERE "user_id" = ${userId}
        ORDER BY "created_at" DESC
      `);
      return result.rows as Notification[];
    });
  }

  // Получение непрочитанных уведомлений пользователя
  async getUserUnreadNotifications(userId: string): Promise<Notification[]> {
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        SELECT * FROM "notifications"
        WHERE "user_id" = ${userId} AND "read" = false
        ORDER BY "created_at" DESC
      `);
      return result.rows as Notification[];
    });
  }

  // Получение непрочитанных уведомлений пользователя по группе
  async getUnreadGroupNotifications(userId: string, groupId: string): Promise<Notification[]> {
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        SELECT * FROM "notifications"
        WHERE "user_id" = ${userId} AND "group_id" = ${groupId} AND "read" = false
        ORDER BY "created_at" DESC
      `);
      return result.rows as Notification[];
    });
  }

  // Получение количества непрочитанных уведомлений по типу для группы
  async getUnreadCountByType(
    userId: string, 
    groupId: string, 
    type: 'message' | 'invite' | 'intent'
  ): Promise<number> {
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM "notifications"
        WHERE "user_id" = ${userId} AND "group_id" = ${groupId} 
        AND "type" = ${type} AND "read" = false
      `);
      return parseInt(String(result.rows[0].count), 10);
    });
  }

  // Получение количества непрочитанных уведомлений для всех групп пользователя
  async getAllUnreadCounts(userId: string): Promise<Record<string, Record<string, number>>> {
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        SELECT "group_id", "type", COUNT(*) as count FROM "notifications"
        WHERE "user_id" = ${userId} AND "read" = false
        GROUP BY "group_id", "type"
      `);
      const counts: Record<string, Record<string, number>> = {};
      for (const row of result.rows) {
        const groupId = String(row.group_id || 'global');
        if (!counts[groupId]) {
          counts[groupId] = {
            message: 0,
            invite: 0,
            intent: 0
          };
        }
        const notificationType = String(row.type) as 'message' | 'invite' | 'intent';
        counts[groupId][notificationType] = parseInt(String(row.count), 10);
      }
      return counts;
    });
  }

  // Пометка уведомления как прочитанного
  async markAsRead(id: string): Promise<Notification> {
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        UPDATE "notifications"
        SET "read" = true
        WHERE "id" = ${id}
        RETURNING *
      `);
      return result.rows[0] as Notification;
    });
  }

  // Пометка всех уведомлений пользователя как прочитанных
  async markAllAsRead(userId: string): Promise<number> {
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        UPDATE "notifications"
        SET "read" = true
        WHERE "user_id" = ${userId} AND "read" = false
        RETURNING id
      `);
      return result.rows.length;
    });
  }

  // Пометка всех уведомлений определенного типа в группе как прочитанных
  async markGroupNotificationsAsRead(
    userId: string, 
    groupId: string, 
    type?: 'message' | 'invite' | 'intent'
  ): Promise<number> {
    return withDbRetry(async () => {
      let query = sql`
        UPDATE "notifications"
        SET "read" = true
        WHERE "user_id" = ${userId} AND "group_id" = ${groupId} AND "read" = false
      `;
      if (type) {
        query = sql`${query} AND "type" = ${type}`;
      }
      query = sql`${query} RETURNING id`;
      const result = await db.execute(query);
      return result.rows.length;
    });
  }

  // Удаление уведомления
  async deleteNotification(id: string): Promise<boolean> {
    return withDbRetry(async () => {
      const result = await db.execute(sql`
        DELETE FROM "notifications"
        WHERE "id" = ${id}
        RETURNING id
      `);
      return result.rows.length > 0;
    });
  }

  // Удаление всех прочитанных уведомлений пользователя старше определенного срока
  async cleanupOldNotifications(
    userId: string, 
    olderThanDays: number = 30
  ): Promise<number> {
    return withDbRetry(async () => {
      const date = new Date();
      date.setDate(date.getDate() - olderThanDays);
      const result = await db.execute(sql`
        DELETE FROM "notifications"
        WHERE "user_id" = ${userId} AND "read" = true AND "created_at" < ${date}
        RETURNING id
      `);
      return result.rows.length;
    });
  }
}

// Экспорт экземпляра сервиса для использования в приложении
export const notificationService = new NotificationService();
