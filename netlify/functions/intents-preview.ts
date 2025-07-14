import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { chatService } from '../../src/lib/chat-service';
import { intentExtractionService } from '../../src/lib/intent-extraction-service';
import { ailockService } from '../../src/lib/ailock/core';

/**
 * A serverless function that extracts intent data from user input for preview purposes.
 * It does NOT create an intent in the database.
 */
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

    const { sessionId, userInput } = JSON.parse(body);

    if (!sessionId || !userInput) {
      return responseWithCORS(400, { error: 'sessionId and userInput are required' });
    }

    // Fetch context from the chat session
    const session = await chatService.getSession(sessionId);
    if (!session) {
      return responseWithCORS(404, { error: 'Session not found' });
    }

    // Fetch the user's Ailock profile for additional context
    const ailockProfile = session.userId ? await ailockService.getFullAilockProfileByUserId(session.userId) : null;

    // Fetch or create chat summary for additional context
    const chatSummary = session.userId ? await chatService.getOrCreateSummary(session.userId) : '';

    // Use the LLM-based service to extract intent data
    const extractedData = await intentExtractionService.extractIntentData(
      userInput,
      session.messages,
      ailockProfile,
      chatSummary
    );

    console.log('✅ Successfully extracted intent data for preview:', extractedData);

    return responseWithCORS(200, {
      message: 'Intent data extracted for preview.',
      intentPreview: extractedData
    });

  } catch (error) {
    console.error('Intent preview extraction error:', error);
    return responseWithCORS(500, {
      error: 'Failed to extract intent for preview',
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
