import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken, getAuthTokenFromHeaders } from '../../src/lib/auth/auth-utils';
import { AilockService } from '../../src/lib/ailock/core';
import { AilockMessageService } from '../../src/lib/ailock/message-service';
import { GroupService } from '../../src/lib/ailock/group-service';
import { db } from '../../src/lib/db';
import { sql } from 'drizzle-orm';

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

async function getUserAilockId(event: HandlerEvent): Promise<string | null> {
  let token: string | null = null;
  const authHeader = event.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = getAuthTokenFromHeaders(event.headers);
  }
  if (!token) {
    return null;
  }
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  try {
    const ailockService = new AilockService();
    const profile = await ailockService.getOrCreateAilock(payload.sub);
    return profile.id;
  } catch (error) {
    console.error('Failed to get user ailock ID:', error);
    return null;
  }
}

async function getInboxSummary(ailockId: string): Promise<{
  unreadCount: number;
  latestTimestamp: string | null;
  hasNewMessages: boolean;
}> {
  try {
    const messageService = new AilockMessageService();
    const unreadInteractions = await messageService.getInbox(ailockId, 'sent', 100);
    const allInteractions = await messageService.getInbox(ailockId, undefined, 10);
    
    return {
      unreadCount: unreadInteractions.length,
      latestTimestamp: allInteractions.length > 0 ? allInteractions[0].createdAt.toISOString() : null,
      hasNewMessages: unreadInteractions.length > 0
    };
  } catch (error) {
    console.error('Failed to get inbox summary:', error);
    return {
      unreadCount: 0,
      latestTimestamp: null,
      hasNewMessages: false
    };
  }
}

/**
 * Получение информации о группах пользователя и активности в них
 */
async function getGroupsSummary(userId: string): Promise<{
  totalGroups: number;
  pendingInvites: number;
  groupsWithNewActivity: number;
  latestGroupActivity: string | null;
}> {
  try {
    const groupService = new GroupService();
    
    // Получаем все группы пользователя
    const userGroups = await groupService.getUserGroups(userId);
    
    // Получаем все приглашения в группы для пользователя
    const pendingGroupInvites = await db.execute(sql`
      SELECT * FROM "group_invites"
      WHERE email = (SELECT email FROM "users" WHERE id = ${userId})
      AND status = 'pending'
    `);
    
    // Получаем статистику по активности в группах
    // Пока временно используем заглушку, позже можно расширить для отслеживания реальной активности
    const groupsWithActivity = userGroups.filter(group => {
      // В будущем здесь можно реализовать проверку наличия новых сообщений или интентов
      return Math.random() > 0.7; // Временная заглушка для демонстрации
    });
    
    // Самая последняя активность в группах
    const latestActivity = userGroups.length > 0 
      ? new Date(Math.max(...userGroups.map(g => g.updated_at.getTime()))).toISOString()
      : null;
    
    return {
      totalGroups: userGroups.length,
      pendingInvites: pendingGroupInvites.rows.length,
      groupsWithNewActivity: groupsWithActivity.length,
      latestGroupActivity: latestActivity
    };
  } catch (error) {
    console.error('Failed to get groups summary:', error);
    return {
      totalGroups: 0,
      pendingInvites: 0,
      groupsWithNewActivity: 0,
      latestGroupActivity: null
    };
  }
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
  }

  if (event.httpMethod !== 'GET') {
    return responseWithCORS(405, { error: 'Method not allowed' });
  }

  const userAilockId = await getUserAilockId(event);
  if (!userAilockId) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  try {
    // Получаем информацию о входящих сообщениях
    const inboxSummary = await getInboxSummary(userAilockId);
    
    // Получаем информацию о группах
    const groupsSummary = await getGroupsSummary(userAilockId);
    
    return responseWithCORS(200, {
      success: true,
      data: {
        ...inboxSummary,
        groups: groupsSummary,
        timestamp: new Date().toISOString(),
        ailockId: userAilockId
      }
    });
  } catch (error) {
    console.error('Failed to get inbox events:', error);
    return responseWithCORS(500, { 
      error: 'Failed to fetch inbox events',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 