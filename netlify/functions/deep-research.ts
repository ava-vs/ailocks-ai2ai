import type { Handler, HandlerEvent } from '@netlify/functions';
import { AilockService } from '../../src/lib/ailock/core';
import { DeepResearchService } from '../../src/lib/deep-research-service';
import { verifyToken } from '../../src/lib/auth/auth-utils';
import { withDbRetry } from '../../src/lib/db';

const responseWithCORS = (statusCode: number, body: any) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
  }
  if (event.httpMethod !== 'POST') {
    return responseWithCORS(405, { error: 'Method Not Allowed' });
  }

  const token = event.headers.authorization?.split(' ')[1];
  if (!token) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return responseWithCORS(403, { error: 'Forbidden: Invalid token' });
  }

  try {
    const { query, options } = JSON.parse(event.body || '{}');
    if (!query) {
      return responseWithCORS(400, { error: 'Query is required' });
    }

    const ailockService = new AilockService();
    const researchService = new DeepResearchService();

    // Wrap the database-dependent call with our retry logic
    const ailock = await withDbRetry(() =>
      ailockService.getOrCreateAilock(payload.sub)
    );
    const skills = ailock.skills || [];

    const report = await researchService.conductResearch(query, skills, options);

    return responseWithCORS(200, report);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Deep research error:', error);
    return responseWithCORS(500, {
      error: 'Failed to conduct deep research.',
      details: errorMessage,
    });
  }
}; 