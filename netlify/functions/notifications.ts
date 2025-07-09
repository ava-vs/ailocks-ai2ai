/**
 * Функция для управления уведомлениями
 * Позволяет создавать уведомления, получать список уведомлений и отмечать их как прочитанные
 */

import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken, getAuthTokenFromHeaders } from '../../src/lib/auth/auth-utils';
import { notificationService } from '../../src/lib/ailock/notification-service';

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Обработка CORS preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
  }

  // Проверка аутентификации - поддержка как заголовка Authorization, так и cookie
  let token: string | null = null;
  let payload: import('../../src/lib/auth/auth-utils').JwtPayload | null = null;
  
  // Проверяем заголовок Authorization
  const authHeader = event.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    payload = verifyToken(token);
  }
  
  // Если токен не найден в заголовке или недействителен, проверяем cookie
  if (!payload || !payload.sub) {
    token = getAuthTokenFromHeaders(event.headers);
    if (token) {
      payload = verifyToken(token);
    }
  }
  
  // Если токен не найден или недействителен, возвращаем 401
  if (!payload || !payload.sub) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  const userId = payload.sub;

  try {
    // GET запрос для получения уведомлений
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const unreadOnly = params.unread === 'true';
      
      let notifications;
      if (unreadOnly) {
        notifications = await notificationService.getUserUnreadNotifications(userId);
      } else {
        notifications = await notificationService.getUserNotifications(userId);
      }

      // Если запрашивается информация о группе
      if (params.group_id) {
        const groupId = params.group_id;
        const typeParam = params.type;
        
        if (typeParam) {
          // Получаем количество непрочитанных уведомлений по типу для группы
          if (['message', 'invite', 'intent'].includes(typeParam)) {
            const count = await notificationService.getUnreadCountByType(
              userId, 
              groupId, 
              typeParam as 'message' | 'invite' | 'intent'
            );
            return responseWithCORS(200, { count });
          }
        } else {
          // Получаем все непрочитанные уведомления для группы
          const groupNotifications = await notificationService.getUnreadGroupNotifications(userId, groupId);
          return responseWithCORS(200, { notifications: groupNotifications });
        }
      }

      // Если запрашивается информация о всех непрочитанных по группам и типам
      if (params.counts === 'true') {
        const counts = await notificationService.getAllUnreadCounts(userId);
        return responseWithCORS(200, { counts });
      }

      return responseWithCORS(200, { notifications });
    }

    // POST запрос для создания нового уведомления
    if (event.httpMethod === 'POST') {
      if (!event.body) {
        return responseWithCORS(400, { error: 'Missing request body' });
      }

      const body = JSON.parse(event.body);
      const { type, title, message, group_id, sender_id, target_user_id } = body;

      // Проверка необходимых полей
      if (!type || !title || !message) {
        return responseWithCORS(400, { error: 'Missing required fields' });
      }

      // Проверка допустимых типов уведомлений
      if (!['message', 'invite', 'intent'].includes(type)) {
        return responseWithCORS(400, { error: 'Invalid notification type' });
      }

      // Если указан целевой пользователь, то отправляем уведомление ему
      const targetUserId = target_user_id || userId;

      // Создаем уведомление
      const notification = await notificationService.createNotification(
        targetUserId,
        type as 'message' | 'invite' | 'intent',
        title,
        message,
        group_id,
        sender_id || userId
      );

      // Отправляем событие через SSE
      // sendEventToClients({
      //   type: 'notification',
      //   id: notification.id,
      //   notificationType: notification.type,
      //   title: notification.title,
      //   message: notification.message,
      //   groupId: notification.group_id,
      //   senderId: notification.sender_id,
      //   createdAt: notification.created_at.toISOString()
      // }, targetUserId);

      return responseWithCORS(201, { notification });
    }

    // PUT запрос для обновления статуса уведомления
    if (event.httpMethod === 'PUT') {
      if (!event.body) {
        return responseWithCORS(400, { error: 'Missing request body' });
      }

      const body = JSON.parse(event.body);

      // Если запрос на пометку всех уведомлений как прочитанных
      if (body.action === 'mark_all_read') {
        const count = await notificationService.markAllAsRead(userId);
        return responseWithCORS(200, { marked: count });
      }

      // Если запрос на пометку уведомлений группы как прочитанных
      if (body.action === 'mark_group_read' && body.group_id) {
        const count = await notificationService.markGroupNotificationsAsRead(
          userId, 
          body.group_id,
          body.type as 'message' | 'invite' | 'intent' | undefined
        );
        return responseWithCORS(200, { marked: count });
      }

      // Если запрос на пометку конкретного уведомления как прочитанного
      if (body.notification_id) {
        const notification = await notificationService.markAsRead(body.notification_id);
        return responseWithCORS(200, { notification });
      }

      return responseWithCORS(400, { error: 'Invalid request body' });
    }

    // DELETE запрос для удаления уведомления
    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {};
      
      // Удаление одного уведомления
      if (params.id) {
        const deleted = await notificationService.deleteNotification(params.id);
        return responseWithCORS(200, { deleted });
      }

      // Очистка старых прочитанных уведомлений
      if (params.cleanup === 'true') {
        const days = params.days ? parseInt(params.days, 10) : 30;
        const deleted = await notificationService.cleanupOldNotifications(userId, days);
        return responseWithCORS(200, { deleted });
      }

      return responseWithCORS(400, { error: 'Missing notification ID' });
    }

    return responseWithCORS(405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('Ошибка в функции управления уведомлениями:', error);
    return responseWithCORS(500, { error: 'Internal Server Error' });
  }
};
