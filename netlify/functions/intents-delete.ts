import { db } from '../../src/lib/db';
import { intents } from '../../src/lib/schema';
import { eq, and } from 'drizzle-orm';
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { ailockService } from '../../src/lib/ailock/core';

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, { message: 'Preflight request processed' });
  }

  if (event.httpMethod !== 'DELETE') {
    return responseWithCORS(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = event.body;
    if (!body) {
      return responseWithCORS(400, { error: 'Request body is required' });
    }

    const { intentId, userId } = JSON.parse(body);

    if (!intentId || !userId) {
      return responseWithCORS(400, { error: 'Intent ID and User ID are required' });
    }

    console.log(`🗑️ Attempting to delete intent ${intentId} for user ${userId}`);

    // First, check if the intent exists and belongs to the user
    const existingIntent = await db
      .select()
      .from(intents)
      .where(and(
        eq(intents.id, intentId),
        eq(intents.userId, userId)
      ))
      .limit(1);

    if (existingIntent.length === 0) {
      return responseWithCORS(404, { 
        error: 'Intent not found or you do not have permission to delete this intent' 
      });
    }

    // Delete the intent
    const deletedIntent = await db
      .delete(intents)
      .where(and(
        eq(intents.id, intentId),
        eq(intents.userId, userId)
      ))
      .returning();

    if (deletedIntent.length === 0) {
      return responseWithCORS(500, { error: 'Failed to delete intent' });
    }

    // --- Ailock XP Deduction ---
    try {
      const ailockProfile = await ailockService.getOrCreateAilock(userId);
      if (ailockProfile) {
        const xpResult = await ailockService.gainXp(ailockProfile.id, 'intent_deleted', { intentId: deletedIntent[0].id });
        console.log(`XP deducted for intent deletion: ${xpResult.xpGained}`);
      }
    } catch (xpError) {
      console.error('Error deducting XP for intent deletion:', xpError);
      // Do not fail the request if XP deduction fails, just log it.
    }
    // --- End Ailock XP Deduction ---

    console.log(`✅ Intent deleted successfully: ${intentId}`);

    return responseWithCORS(200, {
      success: true,
      message: 'Intent deleted successfully',
      deletedIntent: deletedIntent[0]
    });

  } catch (error) {
    console.error('Intent deletion error:', error);
    return responseWithCORS(500, { 
      error: 'Failed to delete intent',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

function responseWithCORS(status: number, body: any) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS'
    },
    body: JSON.stringify(body)
  };
} 