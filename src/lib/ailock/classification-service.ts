import { UnifiedAIService } from '../ai-service';
import { db } from '../db';
import { ailocks, users, ailockSkills } from '../schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { 
  AilockInteraction, 
  MessageClassification, 
  ModerationResult,
  AilockCandidate,
  InteractionContext 
} from '../../types/ailock-interactions';

export interface SkillBasedRouting {
  suggestedRecipients: AilockCandidate[];
  routingConfidence: number;
  fallbackOptions: AilockCandidate[];
}

export interface GeolocationFilter {
  preferLocal: boolean;
  maxDistance: 'city' | 'country' | 'continent' | 'global';
  timezonePriority: boolean;
}

export interface ContentModerationExtended {
  result: ModerationResult;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  autoActions: {
    block: boolean;
    quarantine: boolean;
    requireReview: boolean;
  };
}

export class AilockClassificationService {
  private aiService = new UnifiedAIService();

  /**
   * Продвинутая классификация сообщения с контекстным анализом
   */
  async enhancedClassifyMessage(
    content: string,
    type: AilockInteraction['type'],
    fromAilockId: string,
    context?: InteractionContext
  ): Promise<MessageClassification> {
    
    try {
      // Получаем профиль отправителя для контекста
      const senderProfile = await this.getAilockProfile(fromAilockId);
      const intentDetails = context?.intent ? await this.getIntentDetails(context.intent.id) : null;
      
      const prompt = `
        Проведи детальную классификацию сообщения между AI-помощниками:
        
        СООБЩЕНИЕ: "${content}"
        ТИП ВЗАИМОДЕЙСТВИЯ: ${type}
        
        КОНТЕКСТ ОТПРАВИТЕЛЯ:
        - Уровень: ${senderProfile.level}
        - Основные навыки: ${senderProfile.topSkills.join(', ')}
        - Активность: ${senderProfile.recentActivity}
        
        ${intentDetails ? `
        СВЯЗАННЫЙ ИНТЕНТ:
        - Название: ${intentDetails.title}
        - Категория: ${intentDetails.category}
        - Необходимые навыки: ${intentDetails.requiredSkills?.join(', ') || 'Не указаны'}
        - Бюджет: ${intentDetails.budget || 'Не указан'}
        ` : ''}
        
        ${context?.userLocation ? `
        ГЕОЛОКАЦИЯ:
        - Страна: ${context.userLocation.country}
        - Город: ${context.userLocation.city}
        - Часовой пояс: ${context.userLocation.timezone}
        ` : ''}
        
        АНАЛИЗИРУЙ:
        1. Уровень доверия классификации (0-1)
        2. Необходимые навыки для ответа (массив)
        3. Срочность: low/medium/high
        4. Специализированная категория
        5. Требуется ли ответ
        6. Ожидаемое время ответа
        7. Сложность задачи (1-10)
        8. Приоритет для геолокации
        
        Верни JSON:
        {
          "confidence": number (0-1),
          "suggestedSkills": ["skill1", "skill2"],
          "urgency": "low|medium|high",
          "category": "specific_category",
          "requiresResponse": boolean,
          "estimatedResponseTime": "time_estimate",
          "complexity": number (1-10),
          "geoPriority": "local|regional|global"
        }
      `;

      const result = await this.aiService.getStructuredJsonResponse<MessageClassification>([
        { role: 'user', content: prompt }
      ], {
        complexity: 'medium',
        budget: 'standard'
      });

      return result || this.getDefaultClassification();
      
    } catch (error) {
      console.error('Enhanced classification failed:', error);
      return this.getDefaultClassification();
    }
  }

  /**
   * Умная маршрутизация сообщений на основе навыков
   */
  async skillBasedRouting(
    classification: MessageClassification,
    fromAilockId: string,
    context?: InteractionContext
  ): Promise<SkillBasedRouting> {
    
    try {
      const geoFilter = this.determineGeoFilter(classification, context);
      
      // Поиск Айлоков с нужными навыками
      const candidates = await this.findSkillMatchedAilocks(
        classification.suggestedSkills,
        fromAilockId,
        geoFilter,
        context?.userLocation
      );

      // Ранжирование кандидатов
      const rankedCandidates = await this.rankCandidates(candidates, classification, context);
      
      const topCandidates = rankedCandidates.slice(0, 3);
      const fallbackCandidates = rankedCandidates.slice(3, 6);
      
      return {
        suggestedRecipients: topCandidates,
        routingConfidence: this.calculateRoutingConfidence(topCandidates, classification),
        fallbackOptions: fallbackCandidates
      };
      
    } catch (error) {
      console.error('Skill-based routing failed:', error);
      return {
        suggestedRecipients: [],
        routingConfidence: 0,
        fallbackOptions: []
      };
    }
  }

  /**
   * Расширенная модерация контента
   */
  async moderateContentExtended(
    content: string,
    fromAilockId: string,
    toAilockId?: string
  ): Promise<ContentModerationExtended> {
    
    try {
      const [senderProfile, recipientProfile] = await Promise.all([
        this.getAilockProfile(fromAilockId),
        toAilockId ? this.getAilockProfile(toAilockId) : null
      ]);

      const prompt = `
        Проведи комплексную модерацию сообщения между AI-помощниками:
        
        СООБЩЕНИЕ: "${content}"
        
        ОТПРАВИТЕЛЬ:
        - Уровень: ${senderProfile.level}
        - Репутация: ${senderProfile.reputation}
        - История нарушений: ${senderProfile.violations}
        
        ${recipientProfile ? `
        ПОЛУЧАТЕЛЬ:
        - Уровень: ${recipientProfile.level}
        - Предпочтения: ${recipientProfile.preferences}
        ` : ''}
        
        ПРОВЕРЬ НА:
        1. Спам или реклама
        2. Неуместный контент
        3. Попытки мошенничества
        4. Нарушение этики сотрудничества
        5. Неконструктивные запросы
        6. Превышение границ профессионального общения
        7. Потенциальные конфликты интересов
        
        Верни JSON:
        {
          "result": {
            "flagged": boolean,
            "reason": "string",
            "confidence": number (0-1),
            "categories": ["category1", "category2"]
          },
          "severity": "low|medium|high|critical",
          "recommendations": ["rec1", "rec2"],
          "autoActions": {
            "block": boolean,
            "quarantine": boolean,
            "requireReview": boolean
          }
        }
      `;

      const result = await this.aiService.getStructuredJsonResponse<ContentModerationExtended>([
        { role: 'user', content: prompt }
      ], {
        complexity: 'medium',
        budget: 'standard'
      });

      return result || this.getDefaultModerationResult();
      
    } catch (error) {
      console.error('Extended content moderation failed:', error);
      return this.getDefaultModerationResult();
    }
  }

  /**
   * Геолокационная фильтрация кандидатов
   */
  async applyGeoLocationFilter(
    candidates: AilockCandidate[],
    userLocation?: { country: string; city: string; timezone: string },
    filter: GeolocationFilter = { preferLocal: true, maxDistance: 'country', timezonePriority: false }
  ): Promise<AilockCandidate[]> {
    
    if (!userLocation) return candidates;
    
    return candidates
      .map(candidate => ({
        ...candidate,
        scores: {
          ...candidate.scores,
          location: this.calculateLocationScore(candidate, userLocation, filter)
        }
      }))
      .map(candidate => ({
        ...candidate,
        totalScore: this.recalculateTotalScore(candidate.scores)
      }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Анализ качества потенциального взаимодействия
   */
  async analyzeInteractionQuality(
    fromAilockId: string,
    toAilockId: string,
    classification: MessageClassification
  ): Promise<{
    qualityScore: number;
    compatibilityFactors: string[];
    potentialIssues: string[];
    recommendations: string[];
  }> {
    
    try {
      const [fromProfile, toProfile, historicalData] = await Promise.all([
        this.getAilockProfile(fromAilockId),
        this.getAilockProfile(toAilockId),
        this.getInteractionHistory(fromAilockId, toAilockId)
      ]);

      const prompt = `
        Оцени качество потенциального взаимодействия между AI-помощниками:
        
        ОТПРАВИТЕЛЬ:
        - Уровень: ${fromProfile.level}
        - Навыки: ${fromProfile.topSkills.join(', ')}
        - Стиль общения: ${fromProfile.communicationStyle}
        
        ПОЛУЧАТЕЛЬ:
        - Уровень: ${toProfile.level}
        - Навыки: ${toProfile.topSkills.join(', ')}
        - Стиль общения: ${toProfile.communicationStyle}
        - Доступность: ${toProfile.availability}
        
        ИСТОРИЯ ВЗАИМОДЕЙСТВИЙ:
        - Предыдущих сообщений: ${historicalData.count}
        - Успешных: ${historicalData.successful}
        - Средняя оценка: ${historicalData.averageRating}
        
        ТЕМА СООБЩЕНИЯ:
        - Категория: ${classification.category}
        - Сложность: ${classification.complexity}
        - Срочность: ${classification.urgency}
        
        Оцени по шкале 0-100 и объясни:
        
        Верни JSON:
        {
          "qualityScore": number (0-100),
          "compatibilityFactors": ["factor1", "factor2"],
          "potentialIssues": ["issue1", "issue2"],
          "recommendations": ["rec1", "rec2"]
        }
      `;

      const result = await this.aiService.getStructuredJsonResponse([
        { role: 'user', content: prompt }
      ], {
        complexity: 'medium',
        budget: 'standard'
      });

      return (result as any) || {
        qualityScore: 70,
        compatibilityFactors: ['Общие интересы'],
        potentialIssues: [],
        recommendations: ['Быть конкретным в запросе']
      };
      
    } catch (error) {
      console.error('Interaction quality analysis failed:', error);
      return {
        qualityScore: 50,
        compatibilityFactors: [],
        potentialIssues: ['Недостаточно данных для анализа'],
        recommendations: ['Начать с простого вопроса']
      };
    }
  }

  // === Приватные методы ===

  private async getAilockProfile(ailockId: string): Promise<any> {
    // Временная заглушка - в реальности запрос к БД
    return {
      level: 5,
      topSkills: ['programming', 'design'],
      recentActivity: 'active',
      reputation: 85,
      violations: 0,
      preferences: 'professional',
      communicationStyle: 'technical',
      availability: 'available'
    };
  }

  private async getIntentDetails(intentId: string): Promise<any> {
    // Временная заглушка
    return {
      title: 'Example Intent',
      category: 'technology',
      requiredSkills: ['programming'],
      budget: 1000
    };
  }

  private determineGeoFilter(
    classification: MessageClassification, 
    context?: InteractionContext
  ): GeolocationFilter {
    const urgency = classification.urgency;
    const hasGeoData = !!context?.userLocation;
    
    return {
      preferLocal: urgency === 'high' && hasGeoData,
      maxDistance: urgency === 'high' ? 'city' : urgency === 'medium' ? 'country' : 'global',
      timezonePriority: urgency === 'high'
    };
  }

  private async findSkillMatchedAilocks(
    requiredSkills: string[],
    excludeAilockId: string,
    geoFilter: GeolocationFilter,
    userLocation?: { country: string; city: string; timezone: string }
  ): Promise<any[]> {
    // Временная заглушка - реальный запрос к БД с джойнами
    return [];
  }

  private async rankCandidates(
    candidates: any[],
    classification: MessageClassification,
    context?: InteractionContext
  ): Promise<AilockCandidate[]> {
    // Временная заглушка для ранжирования
    return [];
  }

  private calculateRoutingConfidence(
    candidates: AilockCandidate[],
    classification: MessageClassification
  ): number {
    if (candidates.length === 0) return 0;
    
    const avgScore = candidates.reduce((sum, c) => sum + c.totalScore, 0) / candidates.length;
    const classificationConfidence = classification.confidence;
    
    return Math.min(100, (avgScore * 0.7 + classificationConfidence * 100 * 0.3));
  }

  private calculateLocationScore(
    candidate: AilockCandidate,
    userLocation: { country: string; city: string; timezone: string },
    filter: GeolocationFilter
  ): number {
    // Простая логика расчета геолокационного скора
    let score = 0.5; // базовый скор
    
    // В реальности здесь будет сложная логика с расчетом расстояний
    // и анализом часовых поясов
    
    return Math.min(1.0, score);
  }

  private recalculateTotalScore(scores: any): number {
    const weights = {
      skill: 0.4,
      location: 0.2,
      availability: 0.2,
      reputation: 0.2
    };
    
    return Object.entries(weights).reduce((total, [key, weight]) => {
      return total + (scores[key] || 0) * weight;
    }, 0);
  }

  private async getInteractionHistory(fromId: string, toId: string): Promise<any> {
    // Временная заглушка
    return {
      count: 0,
      successful: 0,
      averageRating: 0
    };
  }

  private getDefaultClassification(): MessageClassification {
    return {
      confidence: 0.5,
      suggestedSkills: [],
      urgency: 'medium',
      category: 'general',
      requiresResponse: true,
      estimatedResponseTime: '2-4 hours'
    };
  }

  private getDefaultModerationResult(): ContentModerationExtended {
    return {
      result: {
        flagged: false,
        confidence: 0.8,
        categories: []
      },
      severity: 'low',
      recommendations: [],
      autoActions: {
        block: false,
        quarantine: false,
        requireReview: false
      }
    };
  }
}

export const ailockClassificationService = new AilockClassificationService(); 