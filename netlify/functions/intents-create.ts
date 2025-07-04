import { db, withDbRetry } from '../../src/lib/db';
import { intents } from '../../src/lib/schema';
import { embeddingService } from '../../src/lib/embedding-service';
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { chatService } from '../../src/lib/chat-service';
import { intentExtractionService } from '../../src/lib/intent-extraction-service';
import { ailockService } from '../../src/lib/ailock/core';

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
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

    // The body now contains a flat object with all necessary data after the preview step.
    const intentData = JSON.parse(body);
    const { sessionId, userId, title, description, category, location, requiredSkills, budget, timeline, priority } = intentData;

    if (!sessionId || !userId || !title) {
      return responseWithCORS(400, { error: 'Session ID, User ID, and Title are required.' });
    }

    console.log('Received requiredSkills type:', typeof requiredSkills, 'value:', JSON.stringify(requiredSkills));
    
    let skillsArray: string[] = [];
    if (Array.isArray(requiredSkills) && requiredSkills.length > 0) {
      skillsArray = requiredSkills.slice(0, 5);
    } else if (typeof requiredSkills === 'object' && requiredSkills !== null) {
      if (Object.keys(requiredSkills).length > 0) {
        skillsArray = Object.values(requiredSkills).filter(skill => typeof skill === 'string');
      }
    }
    
    if (skillsArray.length === 0) {
      skillsArray = ['Collaboration', 'Technology'];
    }
    
    console.log('Using skillsArray for DB:', skillsArray);
    
    // Sanitize and structure the data for saving
    const intentDataToSave = {
      userId: userId,
      title: title.substring(0, 100),
      description: description?.substring(0, 500) || 'Details to be provided.',
      category: category || 'General',
      targetCountry: location?.country || 'BR',
      targetCity: location?.city || 'Rio de Janeiro',
      requiredSkills: skillsArray, 
      budget: budget || null,
      timeline: timeline?.substring(0, 50) || null,
      priority: priority || 'medium',
      status: 'active'
    };

    // Create intent in database, with retry logic for transient connection errors (up to 3 attempts)
    // Always save only a single intent object, never an array
    const newIntent = await withDbRetry(async () => {
      return await db.insert(intents).values(intentDataToSave).returning();
    }, 3); // 3 attempts max

    console.log(`✅ Intent created: ${newIntent[0].id} - ${intentDataToSave.title}`);

    // --- Ailock XP Gain ---
    let xpResult = null;
    if (userId) {
      try {
        const ailockProfile = await ailockService.getOrCreateAilock(userId);
        if (ailockProfile) {
          xpResult = await ailockService.gainXp(ailockProfile.id, 'intent_created', { intentId: newIntent[0].id });
          console.log(`✅ XP Gained for intent creation: ${xpResult.xpGained}`);
          if (xpResult.leveledUp) {
            console.log(`🚀 Ailock leveled up to level ${xpResult.newLevel}!`);
          }
        }
      } catch (xpError) {
        console.error('Error awarding XP for intent creation:', xpError);
      }
    }
    // --- End Ailock XP Gain ---

    // Generate embedding asynchronously (don't wait for completion)
    if (process.env.OPENAI_API_KEY) {
      embeddingService.generateAndStoreIntentEmbedding(newIntent[0].id)
        .then(() => {
          console.log(`✅ Embedding generated for intent: ${newIntent[0].id}`);
        })
        .catch((error: any) => {
          console.warn(`⚠️ Failed to generate embedding for intent ${newIntent[0].id}:`, error);
        });
    } else {
      console.warn('⚠️ OpenAI API key not configured, skipping embedding generation');
    }

    // Update chat context with intent creation
    if (sessionId && userId) {
      const intentCreatedMessage = {
        id: `msg-${Date.now()}-system`,
        role: 'assistant' as const,
        content: `✅ Intent created successfully: "${intentDataToSave.title}". Your collaboration opportunity is now live and visible to potential partners in your area. ${process.env.OPENAI_API_KEY ? 'AI-powered semantic matching is enabled for better discovery.' : ''}`,
        timestamp: new Date(),
        mode: 'system',
        metadata: { intentId: newIntent[0].id, embeddingEnabled: !!process.env.OPENAI_API_KEY }
      };
      try {
        await chatService.saveMessage(sessionId, intentCreatedMessage);
      } catch(e) {
        console.error("Failed to save message to chat history. This might be a local dev issue with blobs.", e);
      }
    }

    return responseWithCORS(201, {
      intent: newIntent[0],
      message: 'Intent created successfully',
      extractedData: intentDataToSave,
      xpResult,
      features: {
        embeddingEnabled: !!process.env.OPENAI_API_KEY,
        semanticSearch: !!process.env.OPENAI_API_KEY
      }
    });

  } catch (error) {
    console.error('Intent creation error:', error);
    return responseWithCORS(500, { 
      error: 'Failed to create intent',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

function responseWithCORS(status: number, body: any) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}