import { db } from '@/lib/db';
import * as schema from '@/lib/schema';
import { verifyToken } from '@/lib/auth/auth-utils';
import { eq, and, desc } from 'drizzle-orm';
import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  const { httpMethod, headers, body } = event;
  
  const token = headers.authorization?.split(' ')[1];
  if (!token) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  const userPayload = verifyToken(token);
  if (!userPayload) {
    return { statusCode: 403, body: 'Forbidden' };
  }
  const userId = userPayload.sub;

  switch (httpMethod) {
    case 'GET': {
      try {
        const inWorkIntents = await db.select({
            intent: schema.intents
          })
          .from(schema.userInWorkIntents)
          .leftJoin(schema.intents, eq(schema.userInWorkIntents.intentId, schema.intents.id))
          .where(eq(schema.userInWorkIntents.userId, userId))
          .orderBy(desc(schema.userInWorkIntents.createdAt));

        return {
          statusCode: 200,
          body: JSON.stringify(inWorkIntents.map(item => item.intent)),
        };
      } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch in-work intents' }) };
      }
    }

    case 'POST': {
      try {
        const { intentId } = JSON.parse(body || '{}');
        if (!intentId) {
          return { statusCode: 400, body: 'Missing intentId' };
        }

        await db.insert(schema.userInWorkIntents).values({
          userId,
          intentId,
        }).onConflictDoNothing();

        return { statusCode: 201, body: JSON.stringify({ success: true }) };
      } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to add intent to in-work list' }) };
      }
    }

    case 'DELETE': {
      try {
        const { intentId } = JSON.parse(body || '{}');
        if (!intentId) {
          return { statusCode: 400, body: 'Missing intentId' };
        }
        
        await db.delete(schema.userInWorkIntents)
          .where(and(
            eq(schema.userInWorkIntents.userId, userId),
            eq(schema.userInWorkIntents.intentId, intentId)
          ));

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to remove intent from in-work list' }) };
      }
    }

    default:
      return { statusCode: 405, body: 'Method Not Allowed' };
  }
};

export { handler }; 