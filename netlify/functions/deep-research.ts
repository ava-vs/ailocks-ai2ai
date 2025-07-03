import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { deepResearchService } from '../../src/lib/deep-research-service';
import { AilockService } from '../../src/lib/ailock/core';
import type { DeepResearchOptions, ResearchReport } from '../../src/lib/deep-research-service';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    },
    body: JSON.stringify(body)
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, { message: 'Preflight request processed' });
  }

  if (event.httpMethod !== 'POST') {
    return responseWithCORS(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = event.body;
    if (!body) {
      return responseWithCORS(400, { error: 'Request body is required' });
    }

    const { query, userId, options } = JSON.parse(body);

    if (!query || !userId) {
      return responseWithCORS(400, { 
        error: 'Missing required fields: query and userId' 
      });
    }

    console.log(`🔍 Deep Research request for user ${userId}: "${query}"`);

    const ailockService = new AilockService();
    
    // Получаем профиль пользователя с навыками
    const profile = await ailockService.getOrCreateAilock(userId);
    
    // Проверяем доступность навыка Deep Research
    const deepResearchSkill = profile.skills.find(s => s.skillId === 'deep_research');
    if (!deepResearchSkill || deepResearchSkill.currentLevel === 0) {
      return responseWithCORS(403, {
        error: 'Deep Research skill not unlocked',
        message: 'Пожалуйста, сначала разблокируйте навык Semantic Search, а затем Deep Research.',
        requiredSkill: 'deep_research',
        currentLevel: deepResearchSkill?.currentLevel || 0
      });
    }

    // Настройки по умолчанию для Deep Research
    const defaultOptions: DeepResearchOptions = {
      maxSources: 10,
      includeAcademic: true,
      includeWeb: true,
      includePatents: false,
      language: 'ru',
      researchDepth: 'comprehensive'
    };

    const researchOptions = { ...defaultOptions, ...options };

    console.log(`📊 Starting research with skill level ${deepResearchSkill.currentLevel}`);

    // Выполняем исследование
    const report: ResearchReport = await deepResearchService.conductResearch(
      query,
      profile.skills,
      researchOptions
    );

    // Начисляем XP за использование навыка
    try {
      await ailockService.gainXp(profile.id, 'skill_used_successfully', {
        skillId: 'deep_research',
        skillLevel: deepResearchSkill.currentLevel,
        sourcesFound: report.sources.length,
        confidence: report.confidence
      });

      // TODO: Добавить обновление статистики использования навыка (счетчик и время последнего использования)
      
      console.log(`✅ XP awarded for Deep Research usage`);
    } catch (xpError) {
      console.warn('Failed to award XP:', xpError);
      // Не прерываем основной процесс из-за ошибки XP
    }

    console.log(`🎯 Research completed: ${report.sources.length} sources, confidence: ${report.confidence}%`);

    return responseWithCORS(200, {
      success: true,
      report,
      skillLevel: deepResearchSkill.currentLevel,
      message: `Исследование завершено! Найдено ${report.sources.length} источников.`
    });

  } catch (error: any) {
    console.error('Deep Research failed:', error);
    
    // Обработка специфичных ошибок
    if (error.message.includes('not unlocked')) {
      return responseWithCORS(403, {
        error: 'Skill not available',
        message: error.message
      });
    }

    if (error.message.includes('Research failed')) {
      return responseWithCORS(500, {
        error: 'Research service error',
        message: 'Не удалось выполнить исследование. Попробуйте позже.',
        details: error.message
      });
    }

    return responseWithCORS(500, {
      error: 'Internal server error',
      message: 'Произошла ошибка при выполнении Deep Research',
      details: error.message
    });
  }
}; 