import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useAuth } from './useAuth';
import { useUserSession } from './useUserSession';

// Типы уведомлений
export type NotificationType = 'message' | 'invite' | 'intent';

// Интерфейс уведомления
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  groupId?: string;
  senderId?: string;
  read: boolean;
  createdAt: string; // ISO string даты
}

// API эндпоинты уведомлений
const NOTIFICATIONS_API = '/.netlify/functions/notifications';
const SSE_API = '/.netlify/functions/notifications-sse';

// Хранилище уведомлений
export const notificationsStore = atom<Notification[]>([]);
// Хранилище счётчиков непрочитанных уведомлений по группам и типам
export const unreadCountsStore = atom<Record<string, Record<string, number>>>({});

/**
 * Добавление уведомления в хранилище
 */
export function addNotification(notification: Notification) {
  const currentNotifications = notificationsStore.get();
  // Проверяем, нет ли уже такого уведомления
  const exists = currentNotifications.some(n => n.id === notification.id);
  if (!exists) {
    notificationsStore.set([notification, ...currentNotifications]);
  }
}

/**
 * Пометка уведомления как прочитанного в хранилище
 */
export function markAsReadInStore(notificationId: string) {
  const currentNotifications = notificationsStore.get();
  notificationsStore.set(
    currentNotifications.map((notification) => 
      notification.id === notificationId ? { ...notification, read: true } : notification
    )
  );
}

/**
 * Пометка всех уведомлений как прочитанных в хранилище
 */
export function markAllAsReadInStore() {
  const currentNotifications = notificationsStore.get();
  notificationsStore.set(
    currentNotifications.map((notification) => ({ ...notification, read: true }))
  );
}

/**
 * Обновление счётчиков непрочитанных уведомлений
 */
export function updateUnreadCounts(counts: Record<string, Record<string, number>>) {
  unreadCountsStore.set(counts);
}

/**
 * Хук для работы с уведомлениями
 * Обеспечивает получение уведомлений через SSE и их управление через API
 */
export default function useNotifications() {
  const notifications = useStore(notificationsStore);
  const unreadCounts = useStore(unreadCountsStore);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();
  const displayUser = authUser || currentUser;

  // Подсчёт всех непрочитанных уведомлений
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  /**
   * Получение всех уведомлений с сервера
   */
  const fetchNotifications = useCallback(async () => {
    if (!displayUser?.id) return;
    setLoading(true);

    try {
      const response = await fetch(`${NOTIFICATIONS_API}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Устанавливаем полученные уведомления в хранилище
        notificationsStore.set(data.notifications || []);
      } else {
        console.error('Ошибка при получении уведомлений:', response.statusText);
      }
    } catch (err) {
      console.error('Ошибка при загрузке уведомлений:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [displayUser?.id]);

  /**
   * Получение счётчиков непрочитанных уведомлений по группам и типам
   */
  const fetchUnreadCounts = useCallback(async () => {
    if (!displayUser?.id) return;

    try {
      const response = await fetch(`${NOTIFICATIONS_API}?counts=true`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        updateUnreadCounts(data.counts || {});
      } else {
        console.error('Ошибка при получении счётчиков уведомлений:', response.statusText);
      }
    } catch (err) {
      console.error('Ошибка при загрузке счётчиков уведомлений:', err);
    }
  }, [displayUser?.id]);

  /**
   * Пометка уведомления как прочитанного
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!displayUser?.id) return;

    try {
      const response = await fetch(`${NOTIFICATIONS_API}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification_id: notificationId,
        })
      });

      if (response.ok) {
        // Обновляем статус уведомления в хранилище
        markAsReadInStore(notificationId);
        // Обновляем счётчики непрочитанных уведомлений
        fetchUnreadCounts();
      } else {
        console.error('Ошибка при отметке уведомления как прочитанного:', response.statusText);
      }
    } catch (err) {
      console.error('Ошибка при обновлении статуса уведомления:', err);
    }
  }, [displayUser?.id, fetchUnreadCounts]);

  /**
   * Пометка всех уведомлений как прочитанных
   */
  const markAllAsRead = useCallback(async () => {
    if (!displayUser?.id) return;

    try {
      const response = await fetch(`${NOTIFICATIONS_API}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'mark_all_read',
        })
      });

      if (response.ok) {
        // Обновляем статус всех уведомлений в хранилище
        markAllAsReadInStore();
        // Обновляем счётчики непрочитанных уведомлений
        fetchUnreadCounts();
      } else {
        console.error('Ошибка при отметке всех уведомлений как прочитанных:', response.statusText);
      }
    } catch (err) {
      console.error('Ошибка при обновлении статуса всех уведомлений:', err);
    }
  }, [displayUser?.id, fetchUnreadCounts]);

  /**
   * Пометка уведомлений группы как прочитанных
   */
  const markGroupAsRead = useCallback(async (groupId: string, type?: NotificationType) => {
    if (!displayUser?.id || !groupId) return;

    try {
      const response = await fetch(`${NOTIFICATIONS_API}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'mark_group_read',
          group_id: groupId,
          type
        })
      });

      if (response.ok) {
        // Обновляем уведомления в хранилище
        const currentNotifications = notificationsStore.get();
        notificationsStore.set(
          currentNotifications.map((notification) => {
            if (notification.groupId === groupId && !notification.read) {
              if (!type || notification.type === type) {
                return { ...notification, read: true };
              }
            }
            return notification;
          })
        );
        
        // Обновляем счётчики непрочитанных уведомлений
        fetchUnreadCounts();
      } else {
        console.error('Ошибка при отметке уведомлений группы как прочитанных:', response.statusText);
      }
    } catch (err) {
      console.error('Ошибка при обновлении статуса уведомлений группы:', err);
    }
  }, [displayUser?.id, fetchUnreadCounts]);

  /**
   * Создание нового уведомления
   */
  const createNotification = useCallback(async (
    type: NotificationType,
    title: string,
    message: string,
    groupId?: string,
    targetUserId?: string
  ) => {
    if (!displayUser?.id) return;

    try {
      const response = await fetch(`${NOTIFICATIONS_API}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          title,
          message,
          group_id: groupId,
          target_user_id: targetUserId
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Если целевой пользователь - текущий, добавляем уведомление в хранилище
        if (!targetUserId || targetUserId === displayUser.id) {
          addNotification(data.notification);
          fetchUnreadCounts();
        }
        return data.notification;
      } else {
        console.error('Ошибка при создании уведомления:', response.statusText);
        return null;
      }
    } catch (err) {
      console.error('Ошибка при создании уведомления:', err);
      return null;
    }
  }, [displayUser?.id, fetchUnreadCounts]);

  // Получение уведомлений при первом рендере и подключение к SSE
  useEffect(() => {
    if (!displayUser?.id) return;

    // Загружаем уведомления с сервера
    fetchNotifications();
    // Загружаем счётчики непрочитанных уведомлений
    fetchUnreadCounts();

    // Подключаемся к SSE серверу для получения обновлений
    let eventSource: EventSource | null = null;
    
    // Параметры для контроля повторных подключений
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const initialReconnectDelay = 5000; // 5 секунд
    const maxReconnectDelay = 300000; // 5 минут
    let reconnectDelay = initialReconnectDelay;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const connectSSE = () => {
      try {
        // Создаём URL для подключения к SSE
        const url = new URL(SSE_API, window.location.origin);
        
        // Создаём EventSource для подключения к серверу событий
        eventSource = new EventSource(url.toString(), {
          withCredentials: true
        });
        
        // EventSource не поддерживает заголовки, используем куки для аутентификации
        
        // Обработчик открытия соединения
        eventSource.onopen = () => {
          setConnected(true);
          setError(null);
          reconnectAttempts = 0;
          reconnectDelay = initialReconnectDelay;
          console.log('SSE соединение установлено');
        };
        
        // Обработчик сообщений
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'notification') {
              // Добавляем уведомление в хранилище
              addNotification({
                id: data.id,
                type: data.notificationType,
                title: data.title,
                message: data.message,
                groupId: data.groupId,
                senderId: data.senderId,
                read: false,
                createdAt: data.createdAt || new Date().toISOString()
              });
              
              // Обновляем счётчики непрочитанных уведомлений
              fetchUnreadCounts();
            } else if (data.type === 'ping') {
              // Пинг для поддержания соединения
              console.log('SSE ping received');
            } else if (data.type === 'connection') {
              // Событие подключения
              console.log('SSE connection event:', data);
            }
          } catch (err) {
            console.error('Ошибка обработки SSE сообщения:', err);
          }
        };
        
        // Обработчик ошибок с экспоненциальной задержкой переподключения
        eventSource.onerror = () => {
          setConnected(false);
          const error = new Error('SSE connection error');
          setError(error);
          console.error(`SSE error event received. Attempt ${reconnectAttempts + 1} of ${maxReconnectAttempts}`);
          
          // Очищаем предыдущий таймер, если он существует
          if (reconnectTimeoutId) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
          }
          
          // Проверяем, не превышено ли максимальное количество попыток
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            
            // Экспоненциальное увеличение задержки (не более максимального значения)
            reconnectDelay = Math.min(
              reconnectDelay * 1.5,
              maxReconnectDelay
            );
            
            console.log(`Следующая попытка переподключения через ${reconnectDelay/1000} сек`);
            
            // Запланировать переподключение
            reconnectTimeoutId = setTimeout(() => {
              if (eventSource) {
                eventSource.close();
                connectSSE();
              }
            }, reconnectDelay);
          } else {
            console.error('Превышено максимальное количество попыток переподключения. Остановка.');
          }
        };
      } catch (err) {
        setConnected(false);
        setError(err as Error);
        console.error('Ошибка при создании SSE соединения:', err);
      }
    };
    
    // Инициируем соединение
    connectSSE();
    
    // При размонтировании компонента закрываем соединение
    return () => {
      if (eventSource) {
        eventSource.close();
        setConnected(false);
      }
    };
  }, [displayUser?.id, fetchNotifications, fetchUnreadCounts]);

  // Получение количества непрочитанных уведомлений для группы по типу
  const getUnreadCountForGroup = useCallback((groupId: string, type?: NotificationType) => {
    if (!groupId || !unreadCounts[groupId]) return 0;
    
    if (type) {
      return unreadCounts[groupId][type] || 0;
    }
    
    // Если тип не указан, суммируем все типы
    return Object.values(unreadCounts[groupId]).reduce((acc, count) => acc + count, 0);
  }, [unreadCounts]);

  return {
    notifications,
    unreadCount,
    connected,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    markGroupAsRead,
    createNotification,
    getUnreadCountForGroup,
    fetchNotifications,
    fetchUnreadCounts
  };
}
