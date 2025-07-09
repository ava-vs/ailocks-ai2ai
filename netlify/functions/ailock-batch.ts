import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken, getAuthTokenFromHeaders } from '../../src/lib/auth/auth-utils';
import { AilockService } from '../../src/lib/ailock/core';
import { AilockMessageService } from '../../src/lib/ailock/message-service';
import { GroupService } from '../../src/lib/ailock/group-service';

function responseWithCORS(statusCode: number, body: any): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return responseWithCORS(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return responseWithCORS(405, { error: 'Method not allowed' });
  }

  const userAilockId = await getUserAilockId(event);
  if (!userAilockId) {
    return responseWithCORS(401, { error: 'Unauthorized' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { requests = [] } = body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return responseWithCORS(400, { error: 'Invalid request format. Expected array of requests.' });
    }

    console.log(`🔄 Processing batch request with ${requests.length} operations`);

    // Initialize services
    const ailockService = new AilockService();
    const messageService = new AilockMessageService();
    const groupService = new GroupService();

    // Process all requests in parallel for better performance
    const results = await Promise.allSettled(
      requests.map(async (req: any, index: number) => {
        try {
          switch (req.type) {
            case 'get_inbox':
              const inbox = await messageService.getInbox(
                userAilockId, 
                req.status || undefined, 
                req.limit || 20, 
                req.offset || 0
              );
              const unreadCount = await getUnreadCount(userAilockId);
              return {
                type: 'get_inbox',
                data: {
                  interactions: inbox,
                  unreadCount,
                  hasMore: inbox.length === (req.limit || 20)
                }
              };

            case 'mark_read':
              if (!req.interactionId) {
                throw new Error('Missing interactionId for mark_read operation');
              }
              await messageService.markAsRead(req.interactionId, userAilockId);
              return {
                type: 'mark_read',
                data: { success: true, interactionId: req.interactionId }
              };

            case 'get_profile':
              const profile = await ailockService.getOrCreateAilock(userAilockId);
              return {
                type: 'get_profile',
                data: profile
              };

            case 'get_daily_tasks':
              const tasks = await ailockService.getTasksForUser(userAilockId);
              return {
                type: 'get_daily_tasks',
                data: tasks
              };

            case 'multiple_mark_read':
              if (!Array.isArray(req.interactionIds)) {
                throw new Error('Missing interactionIds array for multiple_mark_read operation');
              }
              const markResults = await Promise.allSettled(
                req.interactionIds.map((id: string) => 
                  messageService.markAsRead(id, userAilockId)
                )
              );
              const successCount = markResults.filter(r => r.status === 'fulfilled').length;
              return {
                type: 'multiple_mark_read',
                data: { 
                  success: true, 
                  processed: req.interactionIds.length,
                  successful: successCount
                }
              };

            case 'search_ailocks':
              if (!req.query) {
                throw new Error('Missing query for search_ailocks operation');
              }
              const ailockSearchResults = await messageService.searchAilocksByName(req.query);
              return {
                type: 'search_ailocks',
                data: ailockSearchResults
              };

            case 'reply_to_message':
              if (!req.originalInteractionId || !req.responseContent) {
                throw new Error('Missing originalInteractionId or responseContent for reply_to_message operation');
              }
              const replyResult = await messageService.respondToInteraction(
                req.originalInteractionId, 
                userAilockId, 
                req.responseContent,
                req.context
              );
              return {
                type: 'reply_to_message',
                data: replyResult
              };

            case 'archive_message':
              if (!req.interactionId) {
                throw new Error('Missing interactionId for archive_message operation');
              }
              // Архивирование сообщения (будет реализовано в message-service)
              // Пока что используем markAsRead как fallback
              await messageService.markAsRead(req.interactionId, userAilockId);
              return {
                type: 'archive_message',
                data: { success: true, interactionId: req.interactionId, note: 'Archived as read (archive feature coming soon)' }
              };

            case 'send_message':
              if (!req.toAilockId || !req.content || !req.messageType) {
                throw new Error('Missing required fields for send_message operation');
              }
              const sentMessage = await messageService.sendInteraction(
                userAilockId,
                req.toAilockId,
                req.content,
                req.messageType,
                req.context
              );
              return {
                type: 'send_message',
                data: sentMessage
              };

            case 'get_interaction_stats':
              const stats = await messageService.getInteractionStats(userAilockId);
              return {
                type: 'get_interaction_stats',
                data: stats
              };

            case 'bulk_archive':
              if (!Array.isArray(req.interactionIds)) {
                throw new Error('Missing interactionIds array for bulk_archive operation');
              }
              // Пакетное архивирование (пока что используем multiple_mark_read)
              const archiveResults = await Promise.allSettled(
                req.interactionIds.map((id: string) => 
                  messageService.markAsRead(id, userAilockId)
                )
              );
              const archiveSuccessCount = archiveResults.filter(r => r.status === 'fulfilled').length;
              return {
                type: 'bulk_archive',
                data: { 
                  success: true, 
                  processed: req.interactionIds.length,
                  successful: archiveSuccessCount,
                  note: 'Archived as read (archive feature coming soon)'
                }
              };

            // Групповые операции
            case 'get_user_groups':
              const groups = await groupService.getUserGroups(
                userAilockId, 
                req.type || undefined
              );
              return {
                type: 'get_user_groups',
                data: { groups }
              };

            case 'get_group_members':
              if (!req.groupId) {
                throw new Error('Missing groupId for get_group_members operation');
              }
              // Проверяем права доступа
              const hasMembersAccess = await groupService.checkMemberPermission(
                req.groupId,
                userAilockId,
                ['owner', 'admin', 'member', 'guest']
              );
              
              if (!hasMembersAccess) {
                throw new Error('Permission denied');
              }
              
              const members = await groupService.getGroupMembers(req.groupId);
              return {
                type: 'get_group_members',
                data: { members }
              };

            case 'get_group_intents':
              if (!req.groupId) {
                throw new Error('Missing groupId for get_group_intents operation');
              }
              // Проверяем права доступа
              const hasIntentsAccess = await groupService.checkMemberPermission(
                req.groupId,
                userAilockId,
                ['owner', 'admin', 'member', 'guest']
              );
              
              if (!hasIntentsAccess) {
                throw new Error('Permission denied');
              }
              
              const intents = await groupService.getGroupIntents(req.groupId);
              return {
                type: 'get_group_intents',
                data: { intents }
              };

            case 'get_group_details':
              if (!req.groupId) {
                throw new Error('Missing groupId for get_group_details operation');
              }
              // Проверяем права доступа
              const hasDetailsAccess = await groupService.checkMemberPermission(
                req.groupId,
                userAilockId,
                ['owner', 'admin', 'member', 'guest']
              );
              
              if (!hasDetailsAccess) {
                throw new Error('Permission denied');
              }
              
              const group = await groupService.getGroup(req.groupId);
              const groupMembers = await groupService.getGroupMembers(req.groupId);
              const groupIntents = await groupService.getGroupIntents(req.groupId);
              const userMember = groupMembers.find(member => member.user_id === userAilockId);
              
              return {
                type: 'get_group_details',
                data: {
                  group,
                  meta: {
                    membersCount: groupMembers.length,
                    intentsCount: groupIntents.length,
                    userRole: userMember?.role || 'guest'
                  }
                }
              };

            case 'search_users_for_invite':
              if (!req.query) {
                throw new Error('Missing query for search_users_for_invite operation');
              }
              
              const userSearchResults = await groupService.searchUsers(req.query, req.limit || 10);
              return {
                type: 'search_users_for_invite',
                data: { users: userSearchResults }
              };

            default:
              throw new Error(`Unknown request type: ${req.type}`);
          }
        } catch (error) {
          console.error(`Batch operation ${index} (${req.type}) failed:`, error);
          return {
            type: req.type,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: null
          };
        }
      })
    );

    // Format results
    const formattedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          index,
          success: true,
          ...result.value
        };
      } else {
        return {
          index,
          success: false,
          type: requests[index]?.type || 'unknown',
          error: result.reason?.message || 'Operation failed',
          data: null
        };
      }
    });

    const successCount = formattedResults.filter(r => r.success).length;
    console.log(`✅ Batch completed: ${successCount}/${requests.length} operations successful`);

    return responseWithCORS(200, {
      results: formattedResults,
      summary: {
        total: requests.length,
        successful: successCount,
        failed: requests.length - successCount
      }
    });

  } catch (error) {
    console.error('Batch operation failed:', error);
    return responseWithCORS(500, { 
      error: 'Batch operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper function to get unread count
async function getUnreadCount(ailockId: string): Promise<number> {
  try {
    const messageService = new AilockMessageService();
    const unreadInteractions = await messageService.getInbox(ailockId, 'sent', 100);
    return unreadInteractions.length;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
} 