import { UnifiedAIService } from '../ai-service';
import { ailockService } from './core';
import type { AilockInteraction, InteractionContext, AilockSkillLevel } from '../../types/ailock-interactions';

export interface MessageTemplate {
  type: 'clarify_intent' | 'provide_info' | 'collaboration_request' | 'response';
  category: string;
  baseTemplate: string;
  personalizations: {
    formal: string;
    casual: string;
    technical: string;
  };
  requiredData: string[];
}

export interface AutoClarifyResult {
  clarificationNeeded: boolean;
  questions: string[];
  suggestedMessage: string;
  confidence: number;
}

export class AilockTemplateService {
  private aiService = new UnifiedAIService();

  /**
   * Генерация персонализированного сообщения на основе профилей Айлоков
   */
  async generatePersonalizedMessage(
    fromAilockId: string,
    toAilockId: string,
    type: AilockInteraction['type'],
    baseContent: string,
    context?: InteractionContext
  ): Promise<string> {
    
    try {
      // Получаем полные профили отправителя и получателя (включая навыки и достижения)
      const [fromProfile, toProfile] = await Promise.all([
        ailockService.getFullAilockProfileById(fromAilockId),
        ailockService.getFullAilockProfileById(toAilockId)
      ]);

      const prompt = `
        Персонализируй сообщение между AI-помощниками Ailocks:
        
        ОТПРАВИТЕЛЬ:
        - Имя: ${fromProfile.name}
        - Уровень: ${fromProfile.level}
        - Основные навыки: ${this.getTopSkills(fromProfile.skills)}
        - Стиль: ${this.determinePersonalityStyle(fromProfile)}
        
        ПОЛУЧАТЕЛЬ:
        - Имя: ${toProfile.name}
        - Уровень: ${toProfile.level}
        - Основные навыки: ${this.getTopSkills(toProfile.skills)}
        - Стиль: ${this.determinePersonalityStyle(toProfile)}
        
        ТИП ВЗАИМОДЕЙСТВИЯ: ${type}
        БАЗОВОЕ СООБЩЕНИЕ: "${baseContent}"
        ${context?.intent ? `СВЯЗАННЫЙ ИНТЕНТ: ${context.intent.title}` : ''}
        
        ЗАДАЧА:
        1. Адаптируй тон сообщения под уровень и стиль получателя
        2. Добавь технические детали если получатель имеет соответствующие навыки
        3. Сделай сообщение более структурированным и полезным
        4. Включи релевантные детали из контекста
        5. Используй профессиональный, но дружелюбный тон
        
        ОГРАНИЧЕНИЯ:
        - Максимум 300 слов
        - Четкая структура
        - Конкретные действия или вопросы
        
        Верни ТОЛЬКО персонализированный текст сообщения.
      `;

      const personalizedMessage = await this.aiService.generateWithCostOptimization([
        { role: 'user', content: prompt }
      ], {
        complexity: 'medium',
        budget: 'standard'
      });

      return personalizedMessage || baseContent;
      
    } catch (error) {
      console.error('Message personalization failed:', error);
      return baseContent; // Возвращаем оригинал при ошибке
    }
  }

  /**
   * Автоматическое определение необходимости уточнения интента
   */
  async autoClarifyIntent(
    intentId: string,
    sessionId: string,
    fromAilockId: string
  ): Promise<AutoClarifyResult> {
    
    try {
      // Получаем детали интента и историю сессии
      const [intentDetails, chatHistory] = await Promise.all([
        this.getIntentDetails(intentId),
        this.getChatHistory(sessionId)
      ]);

      const prompt = `
        Проанализируй интент и определи нужны ли уточнения:
        
        ИНТЕНТ:
        - Название: ${intentDetails.title}
        - Описание: ${intentDetails.description}
        - Категория: ${intentDetails.category}
        - Необходимые навыки: ${intentDetails.requiredSkills?.join(', ') || 'Не указаны'}
        - Бюджет: ${intentDetails.budget || 'Не указан'}
        - Временные рамки: ${intentDetails.timeline || 'Не указаны'}
        
        ИСТОРИЯ ЧАТА (последние сообщения):
        ${chatHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
        
        ЗАДАЧА:
        Определи нужны ли уточнения для лучшего выполнения интента.
        
        КРИТЕРИИ ДЛЯ УТОЧНЕНИЯ:
        - Неясные требования
        - Отсутствие важных деталей
        - Противоречивая информация
        - Недостаточно конкретики для исполнения
        
        Верни JSON:
        {
          "clarificationNeeded": boolean,
          "questions": ["вопрос1", "вопрос2"],
          "suggestedMessage": "предложенное сообщение для отправки",
          "confidence": 0-100
        }
      `;

      const result = await this.aiService.getStructuredJsonResponse([
        { role: 'user', content: prompt }
      ], {
        complexity: 'medium',
        budget: 'standard'
      });

      return result as AutoClarifyResult || {
        clarificationNeeded: false,
        questions: [],
        suggestedMessage: '',
        confidence: 50
      };
      
    } catch (error) {
      console.error('Auto-clarify failed:', error);
      return {
        clarificationNeeded: false,
        questions: [],
        suggestedMessage: '',
        confidence: 0
      };
    }
  }

  /**
   * Генерация шаблонов сообщений для разных типов взаимодействий
   */
  generateMessageTemplates(): Record<AilockInteraction['type'], MessageTemplate> {
    return {
      clarify_intent: {
        type: 'clarify_intent',
        category: 'information_request',
        baseTemplate: 'Привет! Мне нужно уточнить детали твоего интента "{intentTitle}". ',
        personalizations: {
          formal: 'Здравствуйте! Я хотел бы получить дополнительную информацию по вашему интенту "{intentTitle}". ',
          casual: 'Привет! Увидел твой интент "{intentTitle}" и хочу помочь. ',
          technical: 'Привет! Анализирую технические требования твоего интента "{intentTitle}". '
        },
        requiredData: ['intentTitle', 'questions']
      },
      provide_info: {
        type: 'provide_info',
        category: 'information_sharing',
        baseTemplate: 'У меня есть полезная информация по твоему запросу. ',
        personalizations: {
          formal: 'Предоставляю информацию в соответствии с вашим запросом. ',
          casual: 'Нашел кое-что интересное для тебя! ',
          technical: 'Техническая документация и детали реализации: '
        },
        requiredData: ['information', 'relevance']
      },
      collaboration_request: {
        type: 'collaboration_request',
        category: 'partnership',
        baseTemplate: 'Предлагаю сотрудничество по проекту "{projectName}". ',
        personalizations: {
          formal: 'Рассматриваю возможность профессионального сотрудничества в рамках "{projectName}". ',
          casual: 'Хочешь поработать вместе над "{projectName}"? ',
          technical: 'Техническое партнерство по проекту "{projectName}": '
        },
        requiredData: ['projectName', 'proposal', 'benefits']
      },
      response: {
        type: 'response',
        category: 'reply',
        baseTemplate: 'Отвечаю на твое сообщение. ',
        personalizations: {
          formal: 'В ответ на ваше обращение сообщаю: ',
          casual: 'Отвечаю: ',
          technical: 'Техническое решение: '
        },
        requiredData: ['originalMessage', 'response']
      }
    };
  }

  /**
   * Интеллектуальное предложение следующих действий
   */
  async suggestNextActions(
    interactionHistory: AilockInteraction[],
    currentContext: InteractionContext
  ): Promise<string[]> {
    
    const recentInteractions = interactionHistory.slice(-3);
    
    const prompt = `
      На основе истории взаимодействий предложи следующие действия:
      
      ПОСЛЕДНИЕ ВЗАИМОДЕЙСТВИЯ:
      ${recentInteractions.map(i => 
        `${i.type}: "${i.content}" (статус: ${i.status})`
      ).join('\n')}
      
      ТЕКУЩИЙ КОНТЕКСТ:
      ${currentContext.intent ? `Интент: ${currentContext.intent.title}` : 'Общее общение'}
      
      Предложи 3-5 логичных следующих действий в формате массива строк.
      Каждое действие должно быть конкретным и выполнимым.
    `;

    try {
      const suggestions = await this.aiService.getStructuredJsonResponse([
        { role: 'user', content: prompt }
      ], {
        complexity: 'simple',
        budget: 'free'
      });

      return Array.isArray(suggestions) ? suggestions : [
        'Отправить уточняющий вопрос',
        'Предложить встречу или звонок',
        'Поделиться релевантными ресурсами'
      ];
      
    } catch (error) {
      console.error('Next actions suggestion failed:', error);
      return [
        'Продолжить обсуждение',
        'Запросить дополнительную информацию',
        'Предложить следующие шаги'
      ];
    }
  }

  // === Приватные методы ===

  private getTopSkills(skills: AilockSkillLevel[]): string {
    if (!skills || skills.length === 0) return 'Базовые навыки';
    
    return skills
      .filter(skill => skill.currentLevel > 0)
      .sort((a, b) => b.currentLevel - a.currentLevel)
      .slice(0, 3)
      .map(skill => skill.skillName)
      .join(', ');
  }

  private determinePersonalityStyle(profile: any): 'formal' | 'casual' | 'technical' {
    // Простая логика определения стиля на основе уровня и навыков
    if (profile.level >= 10) return 'formal';
    if (this.hasTechnicalSkills(profile.skills)) return 'technical';
    return 'casual';
  }

  private hasTechnicalSkills(skills: AilockSkillLevel[]): boolean {
    const techSkills = ['programming', 'data_analysis', 'system_design', 'ai_development'];
    return skills?.some(skill => 
      techSkills.some(tech => skill.skillName.toLowerCase().includes(tech))
    ) || false;
  }

  private async getIntentDetails(intentId: string): Promise<any> {
    // В реальной реализации это будет запрос к базе данных
    // Временная заглушка
    return {
      title: 'Example Intent',
      description: 'Example description',
      category: 'general',
      requiredSkills: [],
      budget: null,
      timeline: null
    };
  }

  private async getChatHistory(sessionId: string): Promise<any[]> {
    // В реальной реализации это будет запрос к истории чатов
    // Временная заглушка
    return [];
  }
}

export const ailockTemplateService = new AilockTemplateService(); 