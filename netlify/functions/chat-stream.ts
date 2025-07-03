import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { ChatService } from "../../src/lib/chat-service";
import { UnifiedAIService } from "../../src/lib/ai-service";

const chatService = new ChatService();
const aiService = new UnifiedAIService();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Check if we're in local development mode
// In production, URL env var is always set by Netlify, and DATABASE_URL should exist
const isLocalDev = !process.env.URL || process.env.URL?.includes('localhost') || process.env.URL?.includes('127.0.0.1');

export default async (request: Request) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: CORS_HEADERS
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });
  }

  try {
    const body = await request.text();
    const { message, sessionId, mode, language = 'en', streaming = true, location, userId } = JSON.parse(body || '{}');

    if (!message || !sessionId || !mode) {
      return new Response(JSON.stringify({ error: 'Missing required fields: message, sessionId, mode' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        }
      });
    }

    console.log('🔄 Processing chat message for session:', sessionId, 'user:', userId, 'local dev mode:', isLocalDev);

    // Check if this is a fallback session (non-UUID format)
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId);
    
    let session = null;
    let useDatabase = false;

    if (isValidUUID && !isLocalDev) {
      // Try to get existing session from database (only in production)
      session = await chatService.getSession(sessionId);
      useDatabase = true;
    }
    
    if (!session && userId && userId !== 'loading' && userId !== 'error' && !isLocalDev) {
      try {
        console.log('🆕 Creating new session for user:', userId);
        const newSessionId = await chatService.createSession(userId, mode, language);
        session = await chatService.getSession(newSessionId);
        console.log('✅ New session created:', newSessionId);
        useDatabase = true;
      } catch (error) {
        console.warn('Failed to create new session, using fallback:', error);
        useDatabase = false;
      }
    }

    if (!session) {
      // Create temporary session context for processing
      console.log('⚠️ Using temporary session context (local dev mode or fallback)');
      session = {
        id: sessionId,
        userId: userId || 'anonymous',
        blobKey: `temp-${sessionId}`,
        mode,
        language,
        isActive: true,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      useDatabase = false;
    }

    // Create user message
    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: message,
      timestamp: new Date(),
      mode,
      metadata: { location }
    };

    const userMessageForDb = { ...userMessage, role: 'user' as const };
    if (useDatabase && isValidUUID && !isLocalDev) {
      try {
        console.log('💾 Saving user message to database...');
        await chatService.saveMessage(sessionId, userMessageForDb);
      } catch (error) {
        console.warn('⚠️ Failed to save user message to database, continuing without persistence:', error);
        useDatabase = false;
      }
    } else {
      console.log('⚠️ Skipping database save (local dev mode or fallback session)');
    }

    if (streaming) {
      // Server-Sent Events streaming response
      const streamBody = await streamAilockResponse(message, mode, language, location, sessionId, useDatabase && !isLocalDev);
      return new Response(streamBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...CORS_HEADERS
        }
      });
    } else {
      // Non-streaming response for compatibility
      try {
        const ailockResponse = await processAilockRequest(message, mode, language, location);

        // Create assistant message
        const assistantMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant' as const,
          content: ailockResponse.content,
          timestamp: new Date(),
          mode,
          metadata: { 
            intents: ailockResponse.intents,
            actions: ailockResponse.actions
          }
        };

        // Save assistant message to session if using database
        if (useDatabase && isValidUUID && !isLocalDev) {
          try {
            console.log('💾 Saving assistant message to database...');
            await chatService.saveMessage(sessionId, assistantMessage);
          } catch (error) {
            console.warn('⚠️ Failed to save assistant message to database:', error);
          }
        }

        return new Response(JSON.stringify({
          response: ailockResponse.content,
          messageId: assistantMessage.id,
          sessionId,
          streaming: false,
          intents: ailockResponse.intents,
          actions: ailockResponse.actions
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
          }
        });

      } catch (error) {
        console.error('Ailock processing error:', error);
        
        // Fallback response
        const fallbackResponse = getFallbackResponse(mode, language);
        const assistantMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant' as const,
          content: fallbackResponse,
          timestamp: new Date(),
          mode,
          metadata: { fallback: true }
        };

        // Save fallback message to session if using database
        if (useDatabase && isValidUUID && !isLocalDev) {
          try {
            console.log('💾 Saving fallback message to database...');
            await chatService.saveMessage(sessionId, assistantMessage);
          } catch (error) {
            console.warn('⚠️ Failed to save fallback message to database:', error);
          }
        }

        return new Response(JSON.stringify({
          response: fallbackResponse,
          messageId: assistantMessage.id,
          sessionId,
          streaming: false,
          fallback: true
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
          }
        });
      }
    }

  } catch (error) {
    console.error('Chat stream error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });
  }
};

async function processAilockRequest(
  userMessage: string, 
  mode: string, 
  language: string, 
  location: any
): Promise<{ content: string; intents: any[]; actions: any[] }> {
  
  // 1. Analyze user intent from message
  const userIntent = analyzeUserIntent(userMessage, mode, language);
  
  // 2. Search for relevant intents in database
  const relevantIntents = await searchRelevantIntents(userMessage, location, userIntent);
  
  // 3. Generate Ailock response based on findings
  if (relevantIntents.length > 0) {
    // Found relevant intents - present them as cards
    const response = generateIntentBasedResponse(relevantIntents, language);
    return {
      content: response.content,
      intents: relevantIntents,
      actions: response.actions
    };
  } else {
    // No intents found - suggest creating or searching
    const response = generateNoIntentsResponse(language);
    return {
      content: response.content,
      intents: [],
      actions: response.actions
    };
  }
}

async function streamAilockResponse(
  userMessage: string,
  mode: string,
  language: string,
  location: any,
  sessionId: string,
  useDatabase: boolean
): Promise<string> {
  let streamData = '';
  const assistantMessageId = `msg-${Date.now()}-ai`;

  try {
    // Process Ailock request
    const ailockResponse = await processAilockRequest(userMessage, mode, language, location);
    
    // Stream the response content
    const content = ailockResponse.content;
    const words = content.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      
      streamData += `data: ${JSON.stringify({
        type: 'chunk',
        content: chunk,
        messageId: assistantMessageId,
        sessionId: sessionId
      })}\n\n`;
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Send intents if found
    if (ailockResponse.intents.length > 0) {
      streamData += `data: ${JSON.stringify({
        type: 'intents',
        intents: ailockResponse.intents,
        sessionId: sessionId
      })}\n\n`;
    }

    // Send suggested actions
    if (ailockResponse.actions.length > 0) {
      streamData += `data: ${JSON.stringify({
        type: 'actions',
        actions: ailockResponse.actions,
        sessionId: sessionId
      })}\n\n`;
    }

    // Create complete assistant message
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant' as const,
      content: ailockResponse.content,
      timestamp: new Date(),
      mode,
      metadata: { 
        intents: ailockResponse.intents,
        actions: ailockResponse.actions
      }
    };

    // Save assistant message to session if using database
    if (useDatabase) {
      try {
        console.log('💾 Saving streamed assistant message to database...');
        await chatService.saveMessage(sessionId, assistantMessage);
      } catch (error) {
        console.warn('⚠️ Failed to save streamed assistant message to database:', error);
      }
    }

    // Send completion event
    streamData += `data: ${JSON.stringify({
      type: 'complete',
      messageId: assistantMessageId,
      sessionId: sessionId,
      fullResponse: ailockResponse.content
    })}\n\n`;

  } catch (error) {
    console.error('Ailock streaming error:', error);
    
    // Send error and fallback
    const fallbackResponse = getFallbackResponse(mode, language);
    
    streamData += `data: ${JSON.stringify({
      type: 'error',
      error: 'Ailock service unavailable',
      fallback: fallbackResponse,
      messageId: assistantMessageId,
      sessionId: sessionId
    })}\n\n`;

    // Save fallback to session if using database
    if (useDatabase) {
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant' as const,
        content: fallbackResponse,
        timestamp: new Date(),
        mode,
        metadata: { fallback: true }
      };

      try {
        console.log('💾 Saving fallback message to database...');
        await chatService.saveMessage(sessionId, assistantMessage);
      } catch (error) {
        console.warn('⚠️ Failed to save fallback message to database:', error);
      }
    }
  }

  streamData += `data: [DONE]\n\n`;
  return streamData;
}

function analyzeUserIntent(message: string, mode: string, language: string): any {
  const lowerMessage = message.toLowerCase();
  
  // Определяем тип запроса пользователя
  const intentType = {
    isSearching: lowerMessage.includes('find') || lowerMessage.includes('search') || lowerMessage.includes('look for') || 
                lowerMessage.includes('найти') || lowerMessage.includes('искать') || lowerMessage.includes('поиск'),
    isOffering: lowerMessage.includes('offer') || lowerMessage.includes('provide') || lowerMessage.includes('help with') ||
               lowerMessage.includes('предлагаю') || lowerMessage.includes('могу помочь') || lowerMessage.includes('услуги'),
    isAnalyzing: lowerMessage.includes('analyze') || lowerMessage.includes('research') || lowerMessage.includes('study') ||
                lowerMessage.includes('анализ') || lowerMessage.includes('исследование') || lowerMessage.includes('изучить'),
    isCreating: lowerMessage.includes('create') || lowerMessage.includes('build') || lowerMessage.includes('develop') ||
               lowerMessage.includes('создать') || lowerMessage.includes('разработать') || lowerMessage.includes('построить')
  };

  // Извлекаем ключевые слова и категории
  const keywords = extractKeywords(message);
  const category = detectCategory(message);
  
  return {
    type: intentType,
    keywords,
    category,
    originalMessage: message,
    mode,
    language
  };
}

async function searchRelevantIntents(userMessage: string, location: any, userIntent: any): Promise<any[]> {
  try {
    // Build query parameters for intent search
    const searchQuery = encodeURIComponent(userMessage);
    const userCountry = location?.country || 'BR';
    const userCity = location?.city || 'Rio de Janeiro';
    
    // Construct the URL for internal API call
    const baseUrl = process.env.URL || 'http://localhost:8888';
    const searchUrl = `${baseUrl}/.netlify/functions/intents-list?search=${searchQuery}&userCountry=${userCountry}&userCity=${userCity}&limit=5`;
    
    console.log(`🔍 Searching intents with: "${userMessage}" for ${userCity}, ${userCountry}`);
    
    // Make internal API call to search intents
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.warn(`⚠️ Intent search failed with status: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const intents = data.intents || [];
    
    console.log(`✅ Found ${intents.length} relevant intents`);
    
    // Filter and enhance results based on user message content
    const relevantIntents = intents
      .filter((intent: any) => intent.matchScore > 40) // Only show high-confidence matches
      .map((intent: any) => ({
        ...intent,
        // Add additional context-specific matching
        relevanceReason: generateRelevanceReason(userMessage, intent)
      }));
    
    return relevantIntents;
    
  } catch (error) {
    console.error('❌ Error searching intents:', error);
    return [];
  }
}

function generateRelevanceReason(userMessage: string, intent: any): string {
  const userWords = userMessage.toLowerCase().split(/\s+/);
  const intentText = `${intent.title} ${intent.description}`.toLowerCase();
  
  const matchedSkills = intent.requiredSkills?.filter((skill: string) => 
    userWords.some(word => skill.toLowerCase().includes(word) || word.includes(skill.toLowerCase()))
  ) || [];
  
  const matchedCategories = userWords.filter(word => 
    intent.category.toLowerCase().includes(word) || word.includes(intent.category.toLowerCase())
  );
  
  if (matchedSkills.length > 0) {
    return `Matches your skills: ${matchedSkills.slice(0, 2).join(', ')}`;
  }
  
  if (matchedCategories.length > 0) {
    return `Relevant to ${intent.category}`;
  }
  
  if (intent.semanticMatch) {
    return `AI-powered semantic match`;
  }
  
  return `Geographic match in ${intent.targetCity || intent.targetCountry || 'your area'}`;
}

function generateIntentBasedResponse(intents: any[], language: string): any {
  if (intents.length === 0) {
    return {
      content: "I couldn't find any relevant opportunities for you.",
      actions: [],
      intents: []
    };
  }

  const texts = {
    en: {
      found: `🎯 I found ${intents.length} relevant opportunities for you. Check them out below:`,
      analyzing: "Based on your skills and interests, I've found some exciting collaboration opportunities.",
      actions: {
        viewDetails: "View Details",
        contact: "Contact",
        saveIntent: "Save Intent",
        createSimilar: "Create Similar"
      }
    },
    ru: {
      found: `🎯 Я нашел ${intents.length} релевантных возможностей для вас. Посмотрите их ниже:`,
      analyzing: "На основе ваших навыков и интересов я нашел интересные возможности для сотрудничества.",
      actions: {
        viewDetails: "Подробнее",
        contact: "Связаться",
        saveIntent: "Сохранить",
        createSimilar: "Создать похожий"
      }
    }
  };

  const t = texts[language as keyof typeof texts] || texts.en;
  
  // Create a short, clean message that refers to the intent cards below
  const content = `${t.analyzing}\n\n${t.found}`;
  
  // The actual intents will be displayed as cards below the message, not in the text
  
  const actions = [
    {
      id: 'view-intent-details',
      label: t.actions.viewDetails,
      description: 'View detailed information about selected opportunities',
      icon: 'Eye',
      priority: 'high'
    },
    {
      id: 'contact-intent-owner',
      label: t.actions.contact,
      description: 'Contact the opportunity owner',
      icon: 'MessageCircle',
      priority: 'high'
    },
    {
      id: 'create-similar-intent',
      label: t.actions.createSimilar,
      description: 'Create a similar opportunity',
      icon: 'Copy',
      priority: 'medium'
    }
  ];

  return { content, actions, intents };
}

function generateNoIntentsResponse(language: string): any {
  const texts = {
    en: {
      noResults: "I couldn't find any existing opportunities that match your request in your area.",
      suggestion: "However, I can help you in several ways:",
      createNew: "Create a new opportunity based on your request",
      searchBroader: "Search in a broader geographic area",
      getInsights: "Get market insights and trends for your field",
      actions: {
        createIntent: "Create New Opportunity",
        searchBroader: "Search Broader Area",
        getInsights: "Get Market Insights",
        findExperts: "Find Experts"
      }
    },
    ru: {
      noResults: "Я не смог найти существующие возможности, которые соответствуют вашему запросу в вашем районе.",
      suggestion: "Однако я могу помочь вам несколькими способами:",
      createNew: "Создать новую возможность на основе вашего запроса",
      searchBroader: "Поискать в более широкой географической области",
      getInsights: "Получить рыночные инсайты и тренды для вашей области",
      actions: {
        createIntent: "Создать новую возможность",
        searchBroader: "Расширить поиск",
        getInsights: "Получить инсайты",
        findExperts: "Найти экспертов"
      }
    }
  };

  const t = texts[language as keyof typeof texts] || texts.en;
  
  const content = `${t.noResults}\n\n${t.suggestion}\n\n• ${t.createNew}\n• ${t.searchBroader}\n• ${t.getInsights}`;
  
  const actions = [
    {
      id: 'create-intent-from-request',
      label: t.actions.createIntent,
      description: 'Create a new collaboration opportunity',
      icon: 'Plus',
      priority: 'high'
    },
    {
      id: 'search-broader-area',
      label: t.actions.searchBroader,
      description: 'Expand search to nearby cities',
      icon: 'MapPin',
      priority: 'medium'
    },
    {
      id: 'get-market-insights',
      label: t.actions.getInsights,
      description: 'Get AI-powered market analysis',
      icon: 'TrendingUp',
      priority: 'medium'
    },
    {
      id: 'find-experts',
      label: t.actions.findExperts,
      description: 'Find experts in your field',
      icon: 'Users',
      priority: 'low'
    }
  ];

  return { content, actions };
}

function extractKeywords(message: string): string[] {
  return message.toLowerCase().match(/\b(\w+)\b/g) || [];
}

function detectCategory(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('design') || lowerMessage.includes('ui') || lowerMessage.includes('ux')) return 'Design';
  if (lowerMessage.includes('develop') || lowerMessage.includes('code') || lowerMessage.includes('programming')) return 'Technology';
  if (lowerMessage.includes('research') || lowerMessage.includes('analysis') || lowerMessage.includes('data')) return 'Research';
  if (lowerMessage.includes('marketing') || lowerMessage.includes('content') || lowerMessage.includes('social')) return 'Marketing';
  if (lowerMessage.includes('blockchain') || lowerMessage.includes('crypto') || lowerMessage.includes('web3')) return 'Blockchain';
  if (lowerMessage.includes('security') || lowerMessage.includes('cyber') || lowerMessage.includes('protection')) return 'Security';
  
  return 'General';
}

function calculateMatchScore(userMessage: string, intent: any): number {
  // Простой алгоритм подсчета совпадений
  const userWords = userMessage.toLowerCase().split(/\s+/);
  const intentText = `${intent.title} ${intent.description} ${intent.category}`.toLowerCase();
  
  let matches = 0;
  userWords.forEach(word => {
    if (intentText.includes(word) && word.length > 2) {
      matches++;
    }
  });
  
  return Math.min(95, Math.max(60, (matches / userWords.length) * 100));
}

function calculateDistance(userLocation: any, intent: any): string {
  if (!userLocation || !intent.targetCity) return 'Remote';
  
  if (userLocation.city === intent.targetCity && userLocation.country === intent.targetCountry) {
    return '< 5 miles';
  }
  if (userLocation.country === intent.targetCountry) {
    return '< 50 miles';
  }
  return 'Remote';
}

function getFallbackResponse(mode: string, language: string = 'en'): string {
  const responses = {
    en: {
      researcher: "I'm your AI assistant Ailock. I help you find collaboration opportunities and analyze market trends. Unfortunately, I'm having trouble accessing the database right now, but I can still assist you with creating new opportunities.",
      creator: "I'm Ailock, your creative AI companion! I help you find collaborators and bring ideas to life. While I'm having some technical difficulties, I can still help you brainstorm and create new opportunities.",
      analyst: "I'm Ailock, your strategic AI advisor. I analyze opportunities and provide insights. I'm currently experiencing some connectivity issues, but I can still help you plan and strategize."
    },
    ru: {
      researcher: "Я ваш ИИ-помощник Айлок. Я помогаю находить возможности для сотрудничества и анализировать рыночные тренды. У меня проблемы с доступом к базе данных, но я все еще могу помочь создать новые возможности.",
      creator: "Я Айлок, ваш творческий ИИ-компаньон! Я помогаю находить соавторов и воплощать идеи в жизнь. Хотя у меня технические трудности, я все еще могу помочь с мозговым штурмом и созданием новых возможностей.",
      analyst: "Я Айлок, ваш стратегический ИИ-советник. Я анализирую возможности и предоставляю инсайты. У меня проблемы с подключением, но я все еще могу помочь с планированием и стратегией."
    }
  };

  const modeResponses = responses[language as keyof typeof responses]?.[mode as keyof typeof responses.en] || responses.en.researcher;
  
  return `${modeResponses}\n\n*Note: Using offline mode - Ailock services may be temporarily unavailable.*`;
}