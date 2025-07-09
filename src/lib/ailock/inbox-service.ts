import type { AilockInteraction } from '@/types/ailock-interactions';

export interface InboxState {
  interactions: AilockInteraction[];
  unreadCount: number;
  lastUpdate: Date;
  isLoading: boolean;
  error: string | null;
}

export class AilockInboxService {
  private static instance: AilockInboxService;
  private state: InboxState = {
    interactions: [],
    unreadCount: 0,
    lastUpdate: new Date(0),
    isLoading: false,
    error: null
  };
  
  private subscribers: Set<(state: InboxState) => void> = new Set();
  private cacheKey = 'ailock-inbox-cache';
  private refreshInterval: NodeJS.Timeout | null = null;
  private userId: string | null = null;

  static getInstance(): AilockInboxService {
    if (!AilockInboxService.instance) {
      AilockInboxService.instance = new AilockInboxService();
    }
    return AilockInboxService.instance;
  }

  private constructor() {}

  // Кеширование в localStorage
  private saveToCache() {
    if (!this.userId) return;
    
    const cacheData = {
      interactions: this.state.interactions,
      unreadCount: this.state.unreadCount,
      lastUpdate: this.state.lastUpdate.toISOString(),
      timestamp: Date.now()
    };
    localStorage.setItem(`${this.cacheKey}_${this.userId}`, JSON.stringify(cacheData));
  }

  private loadFromCache(): boolean {
    if (!this.userId) return false;
    
    const cached = localStorage.getItem(`${this.cacheKey}_${this.userId}`);
    if (!cached) return false;
    
    try {
      const cacheData = JSON.parse(cached);
      const isExpired = Date.now() - cacheData.timestamp > 5 * 60 * 1000; // 5 минут
      
      if (isExpired) {
        localStorage.removeItem(`${this.cacheKey}_${this.userId}`);
        return false;
      }
      
      this.state = {
        ...this.state,
        interactions: cacheData.interactions,
        unreadCount: cacheData.unreadCount,
        lastUpdate: new Date(cacheData.lastUpdate)
      };
      
      this.notifySubscribers();
      return true;
    } catch (error) {
      console.error('Failed to load from cache:', error);
      localStorage.removeItem(`${this.cacheKey}_${this.userId}`);
      return false;
    }
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.state));
  }

  // 🚀 Оптимизированный batch запрос с использованием куки
  private async fetchInboxDataBatch(): Promise<{
    interactions: AilockInteraction[];
    unreadCount: number;
  }> {
    const response = await fetch('/.netlify/functions/ailock-batch', {
      method: 'POST',
      credentials: 'include', // Используем HTTP-only куки
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'get_inbox',
            limit: 50,
            status: undefined // Get all interactions
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Batch request failed: ${response.status}`);
    }

    const batchResult = await response.json();
    
    if (!batchResult.results || batchResult.results.length === 0) {
      throw new Error('Invalid batch response format');
    }

    const inboxResult = batchResult.results[0];
    if (!inboxResult.success) {
      throw new Error(inboxResult.error || 'Failed to fetch inbox data');
    }

    return {
      interactions: inboxResult.data.interactions || [],
      unreadCount: inboxResult.data.unreadCount || 0
    };
  }

  // Fallback к индивидуальным API вызовам с куки
  private async fetchInboxDataLegacy(): Promise<InboxResponse> {
    const response = await fetch('/.netlify/functions/ailock-interaction?limit=50', {
      credentials: 'include', // Используем HTTP-only куки
      headers: { 
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch inbox: ${response.status}`);
    }

    return await response.json();
  }

  // Фоновое обновление данных с оптимизацией
  async backgroundRefresh(): Promise<void> {
    if (this.state.isLoading || !this.userId) return;
    
    try {
      this.state = { ...this.state, isLoading: true, error: null };
      this.notifySubscribers();
      
      let interactions: AilockInteraction[] = [];
      let unreadCount = 0;

      try {
        // Try batch API first for better performance
        const batchData = await this.fetchInboxDataBatch();
        interactions = batchData.interactions;
        unreadCount = batchData.unreadCount;
        console.log('✅ Used batch API for inbox refresh');
      } catch (batchError) {
        console.warn('Batch API failed, falling back to legacy API:', batchError);
        // Fallback to legacy API
        const legacyData = await this.fetchInboxDataLegacy();
        interactions = legacyData.interactions || [];
        unreadCount = legacyData.unreadCount || 0;
      }
      
      this.state = {
        ...this.state,
        interactions,
        unreadCount,
        lastUpdate: new Date(),
        isLoading: false,
        error: null
      };
      
      this.saveToCache();
      this.notifySubscribers();
      
    } catch (error) {
      console.error('Background refresh failed:', error);
      this.state = {
        ...this.state,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.notifySubscribers();
    }
  }

  // Пакетная пометка сообщений как прочитанных с оптимистичным обновлением
  async markMultipleAsRead(interactionIds: string[]): Promise<void> {
    if (interactionIds.length === 0 || !this.userId) return;

    const originalState = { ...this.state };
    const originalInteractions = [...this.state.interactions];

    // ✨ OPTIMISTIC UPDATE: Немедленно обновляем UI
    const updatedInteractions = this.state.interactions.map(interaction => {
      if (interactionIds.includes(interaction.id) && interaction.status === 'sent') {
        return { ...interaction, status: 'read' as const, readAt: new Date() };
      }
      return interaction;
    });
    
    const newUnreadCount = updatedInteractions.filter(i => i.status === 'sent').length;

    this.state = {
      ...this.state,
      interactions: updatedInteractions,
      unreadCount: newUnreadCount,
      error: null
    };
    
    this.saveToCache();
    this.notifySubscribers();

    // 🚀 Показываем пользователю мгновенный фидбек
    console.log('✅ Optimistic update: marked', interactionIds.length, 'messages as read');

    // Затем отправляем запрос на сервер в фоне
    this.persistMultipleMarkAsRead(interactionIds, originalState, originalInteractions);
  }

  // Асинхронная персистентность с автоматическим откатом при ошибке
  private async persistMultipleMarkAsRead(
    interactionIds: string[], 
    originalState: InboxState, 
    originalInteractions: AilockInteraction[]
  ): Promise<void> {
    try {
      const response = await fetch('/.netlify/functions/ailock-batch', {
        method: 'POST',
        credentials: 'include', // Используем HTTP-only куки
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              type: 'multiple_mark_read',
              interactionIds
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const result = await response.json();
      const markResult = result.results?.[0];
      
      if (!markResult?.success) {
          throw new Error(markResult?.error || 'Batch mark as read operation failed.');
      }

      // ✅ Успех: сервер подтвердил изменения
      console.log('✅ Server confirmed:', markResult.data.successful, 'messages marked as read');

    } catch (error) {
      console.error('❌ Failed to persist mark as read, reverting optimistic update:', error);
      
      // 🔄 ROLLBACK: откатываем оптимистичное обновление
      this.state = {
          ...originalState,
          interactions: originalInteractions,
          error: 'Failed to mark messages as read. Please try again.'
      };
      this.saveToCache();
      this.notifySubscribers();

      // 📢 Показываем пользователю уведомление об ошибке
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('inbox-error', {
          detail: { 
            message: 'Failed to mark messages as read. Changes have been reverted.',
            action: 'mark_multiple_read',
            interactionIds
          }
        }));
      }
    }
  }

  // Подписка на изменения
  subscribe(callback: (state: InboxState) => void): () => void {
    this.subscribers.add(callback);
    callback(this.state); // Немедленно отправляем текущее состояние
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Запуск автоматического обновления с интеллектуальным polling
  startAutoRefresh(intervalMs: number = 60000): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Используем smart polling с events endpoint
    this.refreshInterval = setInterval(() => {
      this.smartRefresh();
    }, intervalMs);
  }

  // Умное обновление через events endpoint
  private async smartRefresh(): Promise<void> {
    if (!this.userId || this.state.isLoading) return;

    try {
      const response = await fetch('/.netlify/functions/ailock-events', {
        credentials: 'include', // Используем HTTP-only куки
        headers: { 
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('Smart refresh failed, falling back to full refresh');
        return this.backgroundRefresh();
      }

      const eventData = await response.json();
      
      if (!eventData.success) {
        return this.backgroundRefresh();
      }

      const { unreadCount, latestTimestamp, hasNewMessages } = eventData.data;
      
      // Проверяем, нужно ли полное обновление
      const needsFullRefresh = 
        hasNewMessages && 
        (!this.state.lastUpdate || new Date(latestTimestamp) > this.state.lastUpdate);
      
      if (needsFullRefresh) {
        console.log('📩 New messages detected, triggering full refresh');
        return this.backgroundRefresh();
      }
      
      // Обновляем только счетчик, если изменился
      if (this.state.unreadCount !== unreadCount) {
        this.state = { ...this.state, unreadCount };
        this.notifySubscribers();
      }

    } catch (error) {
      console.warn('Smart refresh failed:', error);
      // Fallback to full refresh on error
      this.backgroundRefresh();
    }
  }

  // Остановка автоматического обновления
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Инициализация при загрузке приложения
  async init(userId: string): Promise<void> {
    this.userId = userId;
    this.cacheKey = `ailock-inbox-cache`;
    
    const hasCachedData = this.loadFromCache();
    
    if (!hasCachedData) {
      await this.backgroundRefresh();
    } else {
      // Если есть кеш, обновляем в фоне
      this.backgroundRefresh();
    }
    
    this.startAutoRefresh();
  }

  // Утилита для обновления счетчика
  updateUnreadCount(delta: number): void {
    this.state = {
      ...this.state,
      unreadCount: Math.max(0, this.state.unreadCount + delta)
    };
    this.notifySubscribers();
  }

  // Пометка одного сообщения как прочитанного с оптимистичным обновлением
  markAsRead(interactionId: string): void {
    const interaction = this.state.interactions.find(i => i.id === interactionId);
    if (!interaction || interaction.status === 'read') return;

    const originalState = { ...this.state };
    const originalInteractions = [...this.state.interactions];

    // ✨ OPTIMISTIC UPDATE: Немедленно обновляем UI
    const updatedInteractions = this.state.interactions.map(i => 
      i.id === interactionId 
        ? { ...i, status: 'read' as const, readAt: new Date() }
        : i
    );

    this.state = {
      ...this.state,
      interactions: updatedInteractions,
      unreadCount: Math.max(0, this.state.unreadCount - 1),
      error: null
    };

    this.saveToCache();
    this.notifySubscribers();

    console.log('✅ Optimistic update: marked message as read:', interactionId);

    // Асинхронная персистентность в фоне
    this.persistMarkAsRead(interactionId);
  }

  // Асинхронная персистентность одного сообщения
  private async persistMarkAsRead(interactionId: string): Promise<void> {
    try {
      const response = await fetch('/.netlify/functions/ailock-interaction', {
        method: 'PUT',
        credentials: 'include', // Используем HTTP-only куки
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ interactionId })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Mark as read operation failed');
      }

      console.log('✅ Server confirmed: message marked as read:', interactionId);

    } catch (error) {
      console.error('❌ Failed to persist mark as read:', error);
      
      // Нет отката для одного сообщения - слишком сложно восстановить состояние
      // Вместо этого показываем ошибку и обновляем данные
      this.state = { ...this.state, error: 'Failed to mark message as read' };
      this.notifySubscribers();
      
      // Через некоторое время обновляем данные полностью
      setTimeout(() => {
        this.backgroundRefresh();
      }, 2000);
    }
  }

  // Добавление нового сообщения (для real-time обновлений)
  addNewInteraction(interaction: AilockInteraction): void {
    // Проверяем, что сообщение еще не существует
    const exists = this.state.interactions.find(i => i.id === interaction.id);
    if (exists) return;

    this.state = {
      ...this.state,
      interactions: [interaction, ...this.state.interactions],
      unreadCount: interaction.status === 'sent' ? this.state.unreadCount + 1 : this.state.unreadCount,
      lastUpdate: new Date()
    };

    this.saveToCache();
    this.notifySubscribers();
  }

  // Получение текущего состояния
  getState(): InboxState {
    return { ...this.state };
  }

  // Очистка при logout
  cleanup(): void {
    this.stopAutoRefresh();
    this.subscribers.clear();
    this.state = {
      interactions: [],
      unreadCount: 0,
      lastUpdate: new Date(0),
      isLoading: false,
      error: null
    };
    
    if (this.userId) {
      localStorage.removeItem(`${this.cacheKey}_${this.userId}`);
    }
    
    this.userId = null;
  }
}

// Интерфейс для Legacy API ответа
interface InboxResponse {
  interactions: AilockInteraction[];
  unreadCount: number;
  hasMore?: boolean;
  nextCursor?: string | null;
} 