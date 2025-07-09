/**
 * Функция для работы с SSE (Server-Sent Events)
 * Позволяет отправлять уведомления клиентам в реальном времени
 */

import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken, getAuthTokenFromHeaders } from '../../src/lib/auth/auth-utils';
import { notificationService } from '../../src/lib/ailock/notification-service';

// Хранилище для отслеживания подключенных клиентов
const connectedClients = new Map<string, {
  resolve: (value: string) => void;
  userId: string;
}>();

// Отправка события всем подключенным клиентам или конкретному пользователю
export function sendEventToClients(data: any, userId?: string) {
  const eventData = `data: ${JSON.stringify(data)}\n\n`;
  
  if (userId && connectedClients.has(userId)) {
    try {
      const client = connectedClients.get(userId);
      if (client) {
        client.resolve(eventData);
        connectedClients.delete(userId);
      }
    } catch (error) {
      console.error(`Ошибка при отправке события пользователю ${userId}:`, error);
    }
  } else {
    // Отправка события всем подключенным клиентам
    for (const [clientId, client] of connectedClients.entries()) {
      try {
        client.resolve(eventData);
        connectedClients.delete(clientId);
      } catch (error) {
        console.error(`Ошибка при отправке события клиенту ${clientId}:`, error);
      }
    }
  }
}

// Функция для формирования CORS заголовков
function responseWithCORS(statusCode: number, body: any, eventHeaders?: any): HandlerResponse {
  const origin = eventHeaders?.origin || eventHeaders?.referer?.replace(/\/+$/, '') || 'http://localhost:8888';
  
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Deprecated implementation – replaced by Edge Function in /netlify/edge-functions/notifications-sse.ts
  return {
    statusCode: 410,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: 'Gone',
      message: 'Use Edge Function /notifications-sse instead.'
    })
  };
}

/* Old implementation kept below for reference but unreachable */
/*

  // Обработка CORS preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {}, event.headers);
  }

  if (event.httpMethod !== 'GET') {
    return responseWithCORS(405, { error: 'Method not allowed' }, event.headers);
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
    return responseWithCORS(401, { error: 'Unauthorized' }, event.headers);
  }

  const userId = payload.sub;

  try {
    // Настройка заголовков для SSE соединения
    const origin = event.headers.origin || event.headers.referer?.replace(/\/+$/, '') || 'http://localhost:8888';
    
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    };

    // Получаем непрочитанные уведомления пользователя
    const notifications = await notificationService.getUserUnreadNotifications(userId);

    // Формируем уникальный идентификатор для клиента
    const clientId = `${userId}-${Date.now()}`;

    // Функция для отправки начальных данных и поддержания соединения
    const sendInitialData = () => {
      // Отправляем непрочитанные уведомления клиенту при подключении
      return [
        `id: ${Date.now()}\n`,
        `event: connection\n`,
        `data: ${JSON.stringify({ type: 'connection', status: 'connected', userId })}\n\n`,
        `id: ${Date.now()}\n`,
        `event: notifications\n`,
        `data: ${JSON.stringify({ type: 'notifications', notifications })}\n\n`
      ].join('');
    };

    // Настройка функции для регулярного пинга клиента
    const sendPing = () => {
      return [
        `id: ${Date.now()}\n`,
        `event: ping\n`,
        `data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`
      ].join('');
    };

    // Отправляем инициализационные данные
    const initialData = sendInitialData();
    const pingData = sendPing();
    
    // Регистрируем клиента для будущих уведомлений
    // (Этот код выполнится после возврата ответа, но нужен для дальнейшей работы с клиентом)
    setTimeout(() => {
      // Здесь можно отправить дополнительные уведомления если нужно
      console.log(`Клиент ${clientId} зарегистрирован для получения уведомлений`);
    }, 100);

    // Возвращаем ответ с инициализационными данными и настройкой для стриминга
    return {
      statusCode: 200,
      headers,
      body: initialData + pingData,
      isBase64Encoded: false
    };
  } catch (error) {
    console.error('Ошибка при обработке SSE-соединения:', error);
    return responseWithCORS(500, { error: 'Internal Server Error' }, event.headers);
  }
};
*/
