import { db, withDbRetry } from '../../src/lib/db';
import { intents, users } from '../../src/lib/schema';
import { embeddingService } from '../../src/lib/embedding-service';
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { chatService } from '../../src/lib/chat-service';
import { intentExtractionService } from '../../src/lib/intent-extraction-service';
import { ailockService } from '../../src/lib/ailock/core';
import { eq, sql } from 'drizzle-orm';

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

    // The body can contain a flat object from a preview step, or a minimal one from voice.
    const intentData = JSON.parse(body);
    const { sessionId, userId, title } = intentData;

    if (!userId || !title) {
      return responseWithCORS(400, { error: 'User ID and Title are required.' });
    }
    
    let finalIntentData = { ...intentData };

    // If the intent is not fully formed (e.g., coming from voice agent with just a title),
    // use the extraction service to flesh it out.
    if (!intentData.description) {
      console.log('Description is missing, using intent extraction service to enrich data...');
      
      const session = sessionId ? await chatService.getSession(sessionId) : null;
      const ailockProfile = await ailockService.getFullAilockProfileByUserId(userId);
      const chatSummary = await chatService.getOrCreateSummary(userId);

      const extractedData = await intentExtractionService.extractIntentData(
        title, // Use title as the main input for extraction
        session?.messages || [],
        ailockProfile,
        chatSummary
      );
      
      // Combine original data with extracted data. Extracted data is the source of truth.
      finalIntentData = {
        ...intentData,
        ...extractedData,
      };
      
      console.log('Intent data enriched by LLM:', finalIntentData);
    }
    
    // Destructure again from the now-complete data
    const { description, category, location, requiredSkills, budget, timeline, priority } = finalIntentData;

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
    
    // --- Location Fallback Logic ---
    let finalLocation = location;
    if (!finalLocation && userId) {
      console.log(`Location not provided for user ${userId}, attempting to fetch from profile.`);
      const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (userRecord.length > 0 && userRecord[0].city && userRecord[0].country) {
        finalLocation = { city: userRecord[0].city, country: userRecord[0].country };
        console.log(`Using location from user profile: ${finalLocation.city}, ${finalLocation.country}`);
      }
    }
    // --- End Location Fallback ---

    console.log('Using skillsArray for DB:', skillsArray);
    
    // Sanitize and structure the data for saving
    const intentDataToSave = {
      userId: userId,
      title: title.substring(0, 100),
      description: description?.substring(0, 500) || 'Details to be provided.',
      category: category || 'General',
      targetCountry: finalLocation?.country || 'BR',
      targetCity: finalLocation?.city || 'Rio de Janeiro',
      requiredSkills: skillsArray, 
      budget: budget || null,
      timeline: timeline?.substring(0, 50) || null,
      priority: priority || 'medium',
      status: 'active'
    };

    // Create intent in database, with retry logic for transient connection errors (up to 3 attempts)
    // Always save only a single intent object, never an array
    // Use raw SQL to insert only existing columns, avoiding missing escrow_order_id
    const newIntent = await withDbRetry(async () => {
      const result = await db.execute(sql`
        insert into "intents" (
          "user_id", "title", "description", "category", "target_country", "target_city",
          "required_skills", "budget", "timeline", "priority", "status"
        ) values (
          ${intentDataToSave.userId},
          ${intentDataToSave.title},
          ${intentDataToSave.description},
          ${intentDataToSave.category},
          ${intentDataToSave.targetCountry},
          ${intentDataToSave.targetCity},
          ${`{${skillsArray.map(s => '"' + s.replace(/"/g, '\"') + '"').join(',')}}`},
          ${intentDataToSave.budget},
          ${intentDataToSave.timeline},
          ${intentDataToSave.priority},
          ${intentDataToSave.status}
        ) returning *;
      `);
      return result.rows as any;
    }, 3); // 3 attempts max

    console.log(`✅ Intent created: ${newIntent[0].id} - ${intentDataToSave.title}`);

    // --- Ailock XP Gain ---
    let xpResult = null;
    if (userId) {
      try {
        const ailockProfile = await ailockService.getFullAilockProfileByUserId(userId);
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