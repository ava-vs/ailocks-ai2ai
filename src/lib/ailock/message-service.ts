import { db } from '../db';
import { ailockInteractions, ailocks, users } from '../schema';
import { eq, desc, and, isNull, or, sql } from 'drizzle-orm';
import type { 
  AilockInteraction, 
  MessageClassification, 
  ModerationResult,
  AilockCandidate,
  InteractionContext 
} from '../../types/ailock-interactions';
import { ailockService } from './core';
import { UnifiedAIService } from '../ai-service';

export class AilockMessageService {
  private aiService = new UnifiedAIService();

  /**
   * Отправка сообщения между Айлоками
   */
  async sendInteraction(
    fromAilockId: string,
    toAilockId: string,
    content: string,
    type: AilockInteraction['type'],
    context?: InteractionContext
  ): Promise<AilockInteraction> {
    
    // 1. Валидация существования Айлоков
    await this.validateAilocks(fromAilockId, toAilockId);
    
    // 2-3. Классификация и модерация выполняются параллельно с коротким таймаутом
    const [classification, moderation] = await Promise.all([
      this.classifyMessage(content, type, context),
      this.moderateContent(content)
    ]);
    
    if (moderation.flagged) {
      throw new Error(`Content moderation failed: ${moderation.reason}`);
    }
    
    // 4. Создание записи в БД
    const interactionData = {
      fromAilockId,
      toAilockId,
      interactionType: type,
      messageContent: content,
      classification: classification as any,
      moderation: moderation as any,
      sessionId: context?.intent?.sessionId || null,
      intentId: context?.intent?.id || null,
      chainId: context?.intent?.chainId || null,
      priority: this.calculatePriority(classification.urgency),
      status: 'sent' as const
    };
    
    const [interaction] = await db
      .insert(ailockInteractions)
      .values(interactionData)
      .returning();
    
    // 5. Начислить XP отправителю
    await ailockService.gainXp(fromAilockId, 'ailock_message_sent', {
      toAilockId,
      messageType: type,
      interactionId: interaction.id
    });
    
    // 6. Отправить real-time уведомление (будет реализовано в следующем этапе)
    await this.sendNotification(interaction);
    
    return this.mapDbToInterface(interaction);
  }

  /**
   * Получение входящих сообщений для Айлока
   */
  async getInbox(
    ailockId: string,
    status?: AilockInteraction['status'],
    limit: number = 20,
    offset: number = 0
  ): Promise<AilockInteraction[]> {
    
    const whereConditions = [eq(ailockInteractions.toAilockId, ailockId)];
    
    if (status) {
      whereConditions.push(eq(ailockInteractions.status, status));
    }
    
    const interactions = await db
      .select()
      .from(ailockInteractions)
      .where(and(...whereConditions))
      .orderBy(desc(ailockInteractions.createdAt))
      .limit(limit)
      .offset(offset);
    
    return interactions.map(this.mapDbToInterface);
  }

  /**
   * Пометить сообщение как прочитанное
   */
  async markAsRead(interactionId: string, ailockId: string): Promise<void> {
    const [updated] = await db
      .update(ailockInteractions)
      .set({ 
        status: 'read',
        readAt: new Date()
      })
      .where(
        and(
          eq(ailockInteractions.id, interactionId),
          eq(ailockInteractions.toAilockId, ailockId)
        )
      )
      .returning();
    
    if (!updated) {
      throw new Error('Interaction not found or access denied');
    }
  }

  /**
   * Ответить на сообщение
   */
  async respondToInteraction(
    originalInteractionId: string,
    fromAilockId: string,
    responseContent: string,
    context?: InteractionContext
  ): Promise<AilockInteraction> {
    
    // Получить оригинальное сообщение
    const [original] = await db
      .select()
      .from(ailockInteractions)
      .where(eq(ailockInteractions.id, originalInteractionId))
      .limit(1);
    
    if (!original) {
      throw new Error('Original interaction not found');
    }
    
    // Отправить ответ
    const response = await this.sendInteraction(
      fromAilockId,
      original.fromAilockId, // Ответ отправителю
      responseContent,
      'response',
      context
    );
    
    // Обновить связь с родительским сообщением
    await db
      .update(ailockInteractions)
      .set({ parentInteractionId: originalInteractionId })
      .where(eq(ailockInteractions.id, response.id));
    
    // Пометить оригинальное как отвеченное
    await db
      .update(ailockInteractions)
      .set({ 
        status: 'responded',
        respondedAt: new Date()
      })
      .where(eq(ailockInteractions.id, originalInteractionId));
    
    // Начислить XP за полезный ответ
    await ailockService.gainXp(fromAilockId, 'intent_clarification_provided', {
      originalInteractionId,
      responseInteractionId: response.id
    });
    
    return response;
  }

  /**
   * Поиск Айлоков по имени для голосовых команд
   */
  async searchAilocksByName(name: string): Promise<any[]> {
    try {
      const searchQuery = `%${name.toLowerCase()}%`;
      
      const results = await db
        .select({
          id: ailocks.id,
          name: ailocks.name,
          level: ailocks.level,
          city: users.city,
          country: users.country,
          userName: users.name,
          userEmail: users.email,
          lastActiveAt: ailocks.lastActiveAt
        })
        .from(ailocks)
        .innerJoin(users, eq(ailocks.userId, users.id))
        .where(
          or(
            // SQL LOWER() функция для поиска по имени Айлока
            sql`LOWER(${ailocks.name}) LIKE ${searchQuery}`,
            // Также поиск по имени пользователя
            sql`LOWER(${users.name}) LIKE ${searchQuery}`,
            sql`LOWER(${users.email}) LIKE ${searchQuery}`
          )
        )
        .limit(10);

      return results;
    } catch (error) {
      console.error('Search Ailocks by name error:', error);
      throw new Error('Failed to search Ailocks by name');
    }
  }

  /**
   * Получить статистику взаимодействий Айлока
   */
  async getInteractionStats(ailockId: string): Promise<any> {
    // Это заглушка, полная реализация будет в следующих этапах
    return {
      totalSent: 0,
      totalReceived: 0,
      totalResponded: 0,
      averageResponseTime: '0 min'
    };
  }

  /**
   * Найти лучших Айлоков для определенного интента или типа взаимодействия
   */
  async findBestAilocks(
    requiredSkills: string[],
    location?: { country: string; city: string },
    excludeAilockId?: string
  ): Promise<AilockCandidate[]> {
    
    // Базовый запрос для поиска Айлоков с нужными навыками
    // Полная реализация будет в этапе "Enhanced Classification"
    const ailocksList = await db
      .select()
      .from(ailocks)
      .where(
        excludeAilockId ? 
          and(
            eq(ailocks.id, excludeAilockId) // временно для типизации
          ) : 
          isNull(ailocks.id) // временная заглушка
      )
      .limit(5);
    
    return ailocksList.map(ailock => ({
      ailock,
      scores: {
        skill: 0.8,
        location: 0.6,
        availability: 0.9,
        reputation: 0.7
      },
      totalScore: 0.75,
      estimatedResponseTime: '2-4 hours'
    }));
  }

  // === Приватные методы ===

  private async validateAilocks(fromAilockId: string, toAilockId: string): Promise<void> {
    const [fromAilock, toAilock] = await Promise.all([
      db.select().from(ailocks).where(eq(ailocks.id, fromAilockId)).limit(1),
      db.select().from(ailocks).where(eq(ailocks.id, toAilockId)).limit(1)
    ]);
    
    if (!fromAilock.length) {
      throw new Error('Sender Ailock not found');
    }
    
    if (!toAilock.length) {
      throw new Error('Recipient Ailock not found');
    }
  }

  private async classifyMessage(
    content: string,
    type: AilockInteraction['type'],
    context?: InteractionContext
  ): Promise<MessageClassification> {
    
    const prompt = `
      Classify this Ailock-to-Ailock message:
      Type: ${type}
      Content: "${content}"
      ${context?.intent ? `Related Intent: ${context.intent.title}` : ''}
      
      Analyze:
      1. Confidence level (0-1)
      2. Required skills to respond
      3. Urgency level
      4. Category
      5. Whether it requires a response
      
      Return JSON format.
    `;
    
    try {
      const result = await this.safeStructuredJsonRequest<MessageClassification>([
        { role: 'user', content: prompt }
      ], { complexity: 'simple', budget: 'free' });
      if (result) return result;
    } catch (error) {
      console.error('Classification failed:', error);
    }
    // Fallback
    return {
      confidence: 0.5,
      suggestedSkills: [],
      urgency: 'medium',
      category: 'general',
      requiresResponse: true
    };
  }

  private async moderateContent(content: string): Promise<ModerationResult> {
    const prompt = `
      Moderate this message between AI assistants:
      "${content}"
      
      Check for:
      1. Spam or advertising
      2. Inappropriate content
      3. Fraud attempts
      4. Collaboration ethics violations
      
      Return JSON: { flagged: boolean, reason?: string, confidence: number }
    `;
    
    try {
      const result = await this.safeStructuredJsonRequest<ModerationResult>([
        { role: 'user', content: prompt }
      ], { complexity: 'simple', budget: 'free' });
      if (result) return result;
    } catch (error) {
      console.error('Moderation failed:', error);
    }
    // Fallback
    return { flagged: false, confidence: 0.5 };
  }

  private calculatePriority(urgency: 'low' | 'medium' | 'high'): number {
    const priorities = { low: 30, medium: 50, high: 80 };
    return priorities[urgency];
  }

  private async sendNotification(interaction: any): Promise<void> {
    // Заглушка для real-time уведомлений
    // Будет реализовано в этапе UI Integration
    console.log('Notification sent for interaction:', interaction.id);
  }

  private mapDbToInterface(dbInteraction: any): AilockInteraction {
    return {
      id: dbInteraction.id,
      fromAilockId: dbInteraction.fromAilockId,
      toAilockId: dbInteraction.toAilockId,
      sessionId: dbInteraction.sessionId,
      intentId: dbInteraction.intentId,
      type: dbInteraction.interactionType,
      content: dbInteraction.messageContent,
      classification: dbInteraction.classification,
      moderation: dbInteraction.moderation,
      parentId: dbInteraction.parentInteractionId,
      chainId: dbInteraction.chainId,
      priority: dbInteraction.priority,
      status: dbInteraction.status,
      createdAt: dbInteraction.createdAt,
      readAt: dbInteraction.readAt,
      respondedAt: dbInteraction.respondedAt
    };
  }

  // Utility: make AI request with 10-second timeout + retry 1×
  private async safeStructuredJsonRequest<T>(
    messages: any[],
    options: any,
    timeoutMs = 5000,
    maxAttempts = 1
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const aiPromise = this.aiService.getStructuredJsonResponse<T>(messages, options);
        const result = await this.withTimeout(aiPromise, timeoutMs);
        if (result) return result;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        await new Promise(res => setTimeout(res, 200 * attempt));
      }
    }
    return null;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('AI request timeout')), ms);
      promise.then(v => { clearTimeout(timer); resolve(v); }).catch(err => {
        clearTimeout(timer); reject(err);
      });
    });
  }
}

export const ailockMessageService = new AilockMessageService(); 