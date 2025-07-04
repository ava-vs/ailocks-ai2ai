import { aiService } from './ai-service';
import type { ChatMessage } from './types';
import type { FullAilockProfile } from './ailock/shared';

// Определяем структуру для извлеченных данных интента
interface ExtractedIntentData {
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  budget?: number | null;
  timeline?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

class IntentExtractionService {
  /**
   * Извлекает структурированные данные интента из сообщения пользователя с помощью LLM.
   * @param userInput Последнее сообщение пользователя.
   * @param conversationHistory История переписки для контекста.
   * @param ailockProfile Профиль Ailock пользователя для дополнительного контекста.
   * @returns Структурированные данные интента.
   */
  async extractIntentData(
    userInput: string,
    conversationHistory: ChatMessage[] = [],
    ailockProfile?: FullAilockProfile | null
  ): Promise<ExtractedIntentData> {
    const systemPrompt = this.createSystemPrompt();
    const userMessage = this.createUserMessage(
      userInput,
      conversationHistory,
      ailockProfile
    );

    try {
      const response = await aiService.getStructuredJsonResponse<ExtractedIntentData>(
        [ 
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        {
          complexity: 'complex',
          budget: 'standard',
          mode: 'analyst', // This mode is designed for analysis and structured data
          temperature: 0.2,
        }
      );

      if (!response) {
        throw new Error('LLM returned an empty response.');
      }

      console.log('✅ Successfully extracted intent data from LLM:', response);
      return response;

    } catch (error) {
      console.error('Error extracting intent data from LLM:', error);
      // В случае ошибки LLM, возвращаемся к простому эвристическому методу
      // Это обеспечивает отказоустойчивость системы
      return this.fallbackExtraction(userInput);
    }
  }

  private createSystemPrompt(): string {
    return `
      You are an expert assistant specializing in understanding user requests and converting them into structured "collaboration intents".
      Your task is to analyze the user's message, along with their conversation history and profile, and extract the key details of their intent.
      You must respond with a single, valid JSON object that strictly adheres to the following structure:
      {
        "title": "A concise, descriptive title for the collaboration (max 100 chars).",
        "description": "A detailed description of the project or need (max 500 chars).",
        "category": "The most relevant category from this list: [Technology, Design, Research, Marketing, Business, Travel, Analytics, Blockchain, Security, General].",
        "requiredSkills": "An array of up to 5 essential skills needed for this collaboration.",
        "budget": "The estimated budget as a number, or null if not mentioned.",
        "timeline": "The estimated timeline (e.g., '2 weeks', '3 months'), or null if not mentioned.",
        "priority": "The priority level, must be one of: [low, medium, high, urgent]."
      }
      Do not include any explanations, comments, or any text outside of the JSON object.
    `;
  }

  private createUserMessage(
    userInput: string,
    conversationHistory: ChatMessage[],
    ailockProfile?: FullAilockProfile | null
  ): string {
    let context = 'Here is the data to analyze:\n';

    if (ailockProfile) {
      const userSkills = ailockProfile.skills.map(s => s.skillId).join(', ');
      context += `\n--- User's Ailock Profile ---\nLevel: ${ailockProfile.level}\nSkills: ${userSkills}\n--- End Profile ---\n`;
    }

    if (conversationHistory.length > 0) {
      const historySummary = conversationHistory
        .slice(-10) // Берем последние 10 сообщений для контекста
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');
      context += `\n--- Recent Conversation History ---\n${historySummary}\n--- End History ---\n`;
    }

    context += `\n--- User's Latest Request ---\n${userInput}\n--- End Request ---`;

    context += `\nBased on all the provided information, please extract the intent into the required JSON format.`;

    return context;
  }

  /**
   * Отказоустойчивый метод извлечения, если LLM не справляется.
   */
  private fallbackExtraction(userInput: string): ExtractedIntentData {
    console.warn('⚠️ Using fallback intent extraction method.');
    const sentences = userInput.split(/[.!?]/);
    const title = sentences[0].length > 100 ? sentences[0].substring(0, 97) + '...' : sentences[0];

    return {
      title: title || 'Collaboration Opportunity',
      description: userInput.substring(0, 500),
      category: 'General',
      requiredSkills: ['Collaboration'],
      budget: null,
      timeline: null,
      priority: 'medium',
    };
  }
}

export const intentExtractionService = new IntentExtractionService();
