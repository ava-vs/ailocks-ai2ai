import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIOptions {
  model?: string;
  complexity: 'simple' | 'medium' | 'complex';
  budget: 'free' | 'standard' | 'premium';
  language?: string;
  mode?: string;
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'openrouter';
  model: string;
  cost: number;
  priority: number;
  maxTokens: number;
}

export class UnifiedAIService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private openrouter: OpenAI | null = null;

  constructor() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Anthropic if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    // Initialize OpenRouter as primary provider for cost optimization
    if (process.env.OPENROUTER_API_KEY) {
      this.openrouter = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }
  }

  selectModel(options: AIOptions): ModelConfig {
    const { complexity, mode } = options;

    // ALWAYS START WITH FREE MODEL (90% of requests should use this)
    const freeModel: ModelConfig = {
      provider: 'openrouter',
      model: 'deepseek/deepseek-r1-0528:free',
      cost: 0.0,
      priority: 1.0,
      maxTokens: 1000
    };

    // Only use premium models for complex analysis/creation tasks
    if (complexity === 'complex') {
      
      // ANALYSIS MODE: Complex analysis tasks
      if (mode === 'analyst') {
        return {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          cost: 0.003,
          priority: 0.8,
          maxTokens: 1500
        };
      }

      // CREATOR MODE: Complex creative tasks  
      if (mode === 'creator') {
        return {
          provider: 'openai',
          model: 'gpt-4o',
          cost: 0.005,
          priority: 0.7,
          maxTokens: 1500
        };
      }
    }

    // DEFAULT: Always return free model for simple/medium complexity
    return freeModel;
  }

  async generateWithCostOptimization(
    messages: AIMessage[],
    options: AIOptions,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const modelConfig = this.selectModel(options);
    
    try {
      // Try primary model
      return await this.callModel(modelConfig, messages, onChunk);
    } catch (error) {
      console.warn(`Primary model ${modelConfig.model} failed:`, error);
      
      // Fallback to free model if not already using it
      if (modelConfig.model !== 'deepseek/deepseek-r1-0528:free') {
        try {
          const freeModel: ModelConfig = {
            provider: 'openrouter',
            model: 'deepseek/deepseek-r1-0528:free',
            cost: 0.0,
            priority: 1.0,
            maxTokens: 1000
          };
          return await this.callModel(freeModel, messages, onChunk);
        } catch (fallbackError) {
          console.warn('Free model also failed:', fallbackError);
        }
      }
      
      // Final fallback - static response
      return "I apologize, but I'm experiencing technical difficulties. Please try again later.";
    }
  }

  // Legacy method for backward compatibility
  async generateResponse(
    messages: AIMessage[],
    options: AIOptions,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    return this.generateWithCostOptimization(messages, options, onChunk);
  }

  private async callModel(
    config: ModelConfig,
    messages: AIMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    // Add system prompt based on mode
    const systemPrompt = this.getSystemPrompt(messages.find(m => m.role === 'system')?.content || '', config);
    const fullMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.filter(m => m.role !== 'system')
    ];

    switch (config.provider) {
      case 'anthropic':
        if (!this.anthropic) throw new Error('Anthropic not initialized');
        return await this.callAnthropic(fullMessages, config, onChunk);
      
      case 'openrouter':
        if (!this.openrouter) throw new Error('OpenRouter not initialized');
        return await this.callOpenAI(this.openrouter, fullMessages, config, onChunk);
      
      case 'openai':
      default:
        if (!this.openai) throw new Error('OpenAI not initialized');
        return await this.callOpenAI(this.openai, fullMessages, config, onChunk);
    }
  }

  private async callOpenAI(
    client: OpenAI,
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    if (onChunk) {
      // Streaming response
      const stream = await client.chat.completions.create({
        model: config.model,
        messages: messages,
        max_tokens: config.maxTokens,
        temperature: 0.7,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }
      return fullResponse;
    } else {
      // Non-streaming response
      const response = await client.chat.completions.create({
        model: config.model,
        messages: messages,
        max_tokens: config.maxTokens,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || '';
    }
  }

  private async callAnthropic(
    messages: AIMessage[],
    config: ModelConfig,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic not initialized');
    }

    // Convert messages format for Anthropic
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    if (onChunk) {
      // Streaming response
      const stream = await this.anthropic.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemMessage?.content || '',
        messages: conversationMessages,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const content = chunk.delta.text;
          fullResponse += content;
          onChunk(content);
        }
      }
      return fullResponse;
    } else {
      // Non-streaming response
      const response = await this.anthropic.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemMessage?.content || '',
        messages: conversationMessages,
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    }
  }

  private getSystemPrompt(existingPrompt: string, config: ModelConfig): string {
    const basePrompt = existingPrompt || `You are Ailocks, an advanced AI assistant specializing in collaboration and networking. You help users find opportunities, analyze markets, and connect with the right people.`;
    
    // Add cost optimization note for free models
    if (config.cost === 0) {
      return `${basePrompt}\n\nNote: You are running on a cost-optimized model. Provide concise, helpful responses while maintaining quality.`;
    }
    
    return basePrompt;
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; providers: string[] }> {
    const availableProviders = [];
    
    if (this.openrouter) {
      availableProviders.push('openrouter');
    }
    
    if (this.openai) {
      availableProviders.push('openai');
    }
    
    if (this.anthropic) {
      availableProviders.push('anthropic');
    }

    return {
      status: availableProviders.length > 0 ? 'available' : 'unavailable',
      providers: availableProviders
    };
  }
}

export const aiService = new UnifiedAIService();