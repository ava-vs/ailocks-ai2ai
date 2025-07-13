import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyToken, getAuthTokenFromHeaders } from '../../src/lib/auth/auth-utils';
import { AilockService } from '../../src/lib/ailock/core';
import { AilockMessageService } from '../../src/lib/ailock/message-service';
import { GroupService } from '../../src/lib/ailock/group-service';
import { eq, desc, and, inArray, or, isNotNull, isNull, asc } from 'drizzle-orm';
import { db, withDbRetry } from '@/lib/db';
import * as schema from '@/lib/schema';

// Define more specific types for batch requests
interface GetInboxRequest { type: 'get_inbox'; status?: 'sent' | 'read'; limit?: number; offset?: number; }
interface MarkReadRequest { type: 'mark_read'; interactionId: string; }
interface GetProfileRequest { type: 'get_profile'; }
interface GetProfileByUserIdRequest { type: 'get_profile_by_user_id'; userId: string; }
interface GetDailyTasksRequest { type: 'get_daily_tasks'; }
interface MultipleMarkReadRequest { type: 'multiple_mark_read'; interactionIds: string[]; }
interface SearchAilocksRequest { type: 'search_ailocks'; query: string; }
interface ReplyToMessageRequest { type: 'reply_to_message'; originalInteractionId: string; responseContent: string; context?: any; }
interface ArchiveMessageRequest { type: 'archive_message'; interactionId: string; }
interface SendMessageRequest { type: 'send_message'; toAilockId: string; content: string; messageType: 'clarify_intent' | 'provide_info' | 'collaboration_request' | 'response'; context?: any; }
interface GetInteractionStatsRequest { type: 'get_interaction_stats'; }
interface BulkArchiveRequest { type: 'bulk_archive'; interactionIds: string[]; }
// Corrected the conflicting 'type' property
interface GetUserGroupsRequest { type: 'get_user_groups'; groupType?: string; }
interface GetGroupMembersRequest { type: 'get_group_members'; groupId: string; }
interface GetGroupIntentsRequest { type: 'get_group_intents'; groupId: string; }
interface GetGroupDetailsRequest { type: 'get_group_details'; groupId: string; }
interface SearchUsersForInviteRequest { type: 'search_users_for_invite'; query: string; limit?: number; }
interface GetIntentInteractionsRequest { type: 'get_intent_interactions'; intentId: string; }
// Добавляю новый тип запроса для batch
interface MyIntentsWithInteractionsRequest { type: 'my_intents_with_interactions'; }

type BatchRequest =
  | GetInboxRequest
  | MarkReadRequest
  | GetProfileRequest
  | GetProfileByUserIdRequest
  | GetDailyTasksRequest
  | MultipleMarkReadRequest
  | SearchAilocksRequest
  | ReplyToMessageRequest
  | ArchiveMessageRequest
  | SendMessageRequest
  | GetInteractionStatsRequest
  | BulkArchiveRequest
  | GetUserGroupsRequest
  | GetGroupMembersRequest
  | GetGroupIntentsRequest
  | GetGroupDetailsRequest
  | SearchUsersForInviteRequest
  | GetIntentInteractionsRequest
  | MyIntentsWithInteractionsRequest;

function responseWithCORS(statusCode: number, body: Record<string, unknown> | unknown[]): HandlerResponse {
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
    const profile = await withDbRetry(() => ailockService.getOrCreateAilock(payload.sub));
    return profile.id;
  } catch (error) {
    console.error('Failed to get user ailock ID:', error);
    return null;
  }
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  try {
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

    const body: { requests?: BatchRequest[] } = JSON.parse(event.body || '{}');
    const { requests = [] } = body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return responseWithCORS(400, { error: 'Invalid request format. Expected array of requests.' });
    }

    console.log(`🔄 Processing batch request with ${requests.length} operations`);

    // Initialize services
    const ailockService = new AilockService();
    const messageService = new AilockMessageService();
    const groupService = new GroupService();

    // Helper for permission checks
    const checkGroupPermission = async (groupId: string, allowedRoles: ('owner' | 'admin' | 'member' | 'guest')[]) => {
      const hasAccess = await groupService.checkMemberPermission(groupId, userAilockId, allowedRoles);
      if (!hasAccess) {
        throw new Error(`Permission denied for group ${groupId}`);
      }
    };

    // Process all requests in parallel for better performance
    const results = await Promise.allSettled(
      requests.map(async (req: BatchRequest, index: number) => {
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
              if (req.type === 'mark_read' && !req.interactionId) {
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

            case 'get_profile_by_user_id':
              if (req.type !== 'get_profile_by_user_id' || !req.userId) {
                throw new Error('Missing userId for get_profile_by_user_id operation');
              }
              const userProfile = await ailockService.getOrCreateAilock(req.userId);
              return {
                type: 'get_profile_by_user_id',
                data: userProfile
              };

            case 'get_daily_tasks':
              const tasks = await ailockService.getTasksForUser(userAilockId);
              return {
                type: 'get_daily_tasks',
                data: tasks
              };

            case 'multiple_mark_read':
              if (req.type === 'multiple_mark_read' && !Array.isArray(req.interactionIds)) {
                throw new Error('Missing interactionIds array for multiple_mark_read operation');
              }
              const markResults = await Promise.allSettled(
                req.interactionIds.map((id: string) => 
                  messageService.markAsRead(id, userAilockId)
                )
              );
              const successCount = markResults.filter(r => r.status === 'fulfilled').length;
              if (req.type === 'multiple_mark_read') { // Type guard
                return {
                  type: 'multiple_mark_read',
                  data: { 
                    success: true, 
                    processed: req.interactionIds.length,
                    successful: successCount
                  }
                };
              }
              // This part should not be reached due to switch logic, but satisfies TS
              throw new Error("Logic error in multiple_mark_read");


            case 'search_ailocks':
              if (req.type === 'search_ailocks' && !req.query) {
                throw new Error('Missing query for search_ailocks operation');
              }
              const ailockSearchResults = await messageService.searchAilocksByName(req.query);
              return {
                type: 'search_ailocks',
                data: ailockSearchResults
              };

            case 'reply_to_message':
              if (req.type === 'reply_to_message' && (!req.originalInteractionId || !req.responseContent)) {
                throw new Error('Missing originalInteractionId or responseContent for reply_to_message operation');
              }
              const replyResult = await messageService.respondToInteraction(
                req.originalInteractionId, 
                userAilockId, 
                req.responseContent,
                req.context
              );
              if (req.type === 'reply_to_message') { // Type guard
                return {
                  type: 'reply_to_message',
                  data: replyResult
                };
              }
              throw new Error("Logic error in reply_to_message");


            case 'archive_message':
              if (req.type === 'archive_message' && !req.interactionId) {
                throw new Error('Missing interactionId for archive_message operation');
              }
              // Архивирование сообщения (будет реализовано в message-service)
              // Пока что используем markAsRead как fallback
              await messageService.markAsRead(req.interactionId, userAilockId);
              if (req.type === 'archive_message') {
                return {
                  type: 'archive_message',
                  data: { success: true, interactionId: req.interactionId, note: 'Archived as read (archive feature coming soon)' }
                };
              }
              throw new Error("Logic error in archive_message");


            case 'send_message':
              if (req.type === 'send_message' && (!req.toAilockId || !req.content || !req.messageType)) {
                throw new Error('Missing required fields for send_message operation');
              }
              const sentMessage = await messageService.sendInteraction(
                userAilockId,
                req.toAilockId,
                req.content,
                req.messageType,
                req.context
              );
              if (req.type === 'send_message') {
                return {
                  type: 'send_message',
                  data: sentMessage
                };
              }
              throw new Error("Logic error in send_message");


            case 'get_interaction_stats':
              const stats = await messageService.getInteractionStats(userAilockId);
              return {
                type: 'get_interaction_stats',
                data: stats
              };

            case 'bulk_archive':
              if (req.type === 'bulk_archive' && !Array.isArray(req.interactionIds)) {
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
                req.groupType
              );
              return {
                type: 'get_user_groups',
                data: { groups }
              };

            case 'get_group_members':
              if (req.type !== 'get_group_members' || !req.groupId) {
                throw new Error('Missing groupId for get_group_members operation');
              }
              await checkGroupPermission(req.groupId, ['owner', 'admin', 'member', 'guest']);
              const members = await groupService.getGroupMembers(req.groupId);
              return {
                type: 'get_group_members',
                data: { members }
              };

            case 'get_group_intents':
              if (req.type !== 'get_group_intents' || !req.groupId) {
                throw new Error('Missing groupId for get_group_intents operation');
              }
              await checkGroupPermission(req.groupId, ['owner', 'admin', 'member', 'guest']);
              const intents = await groupService.getGroupIntents(req.groupId);
              return {
                type: 'get_group_intents',
                data: { intents }
              };

            case 'get_group_details':
              if (req.type !== 'get_group_details' || !req.groupId) {
                throw new Error('Missing groupId for get_group_details operation');
              }
              await checkGroupPermission(req.groupId, ['owner', 'admin', 'member', 'guest']);
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
              if (req.type !== 'search_users_for_invite' || !req.query) {
                throw new Error('Missing query for search_users_for_invite operation');
              }
              
              const userSearchResults = await groupService.searchUsers(req.query, req.limit || 10);
              return {
                type: 'search_users_for_invite',
                data: { users: userSearchResults }
              };

            case 'get_intent_interactions':
              if (req.type !== 'get_intent_interactions' || !req.intentId) {
                throw new Error('Missing intentId for get_intent_interactions operation');
              }
              const { intentId } = req;
              const result = await handleGetIntentInteractions(intentId, userAilockId);
              return { type: 'get_intent_interactions', data: result };

            // Новый тип запроса: мои интенты + сообщения к ним
            case 'my_intents_with_interactions': {
              // Получаем все интенты пользователя
              const myIntents = await withDbRetry(() => db.query.intents.findMany({
                where: eq(schema.intents.userId, userAilockId),
                orderBy: [desc(schema.intents.createdAt)],
              }));
              // Для каждого интента — сообщения
              const intentInteractions = await Promise.all(
                myIntents.map(async (intent) => {
                  const interactions = await withDbRetry(() => db.query.ailockInteractions.findMany({
                    where: eq(schema.ailockInteractions.intentId, intent.id),
                    orderBy: [asc(schema.ailockInteractions.createdAt)],
                  }));
                  return { intent, interactions };
                })
              );
              return {
                type: 'my_intents_with_interactions',
                data: intentInteractions
              };
            }

            default:
              // This should be unreachable if BatchRequest is a comprehensive discriminated union
              const exhaustiveCheck: never = req;
              throw new Error(`Unknown request type: ${(exhaustiveCheck as any)?.type}`);
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

interface ClientContext {
  user: {
    sub: string;
  };
}

async function handleGetIntentInteractions(intentId: string, currentAilockId: string): Promise<any> {
  try {
    const interactions = await withDbRetry(async () => {
      const ailock = await db.query.ailocks.findFirst({
        where: eq(schema.ailocks.id, currentAilockId)
      });
      if (!ailock) throw new Error('Ailock not found');
      const currentUserId = ailock.userId; // keep for group membership checks

      const groupIntent = await db.query.groupIntents.findFirst({
        where: eq(schema.groupIntents.intentId, intentId),
        with: {
          group: {
            with: {
              members: {
                where: eq(schema.groupMembers.userId, currentUserId)
              }
            }
          }
        }
      });
      
      const isMemberOfGroup = !!groupIntent?.group.members.length;

      const accessClauses = [];

      // Condition 1: Direct messages (toAilockId is not null)
      accessClauses.push(
        and(
          isNotNull(schema.ailockInteractions.toAilockId),
          or(
            eq(schema.ailockInteractions.fromAilockId, currentAilockId),
            eq(schema.ailockInteractions.toAilockId, currentAilockId)
          )
        )
      );

      // Condition 2: Group messages (toAilockId is null)
      if (isMemberOfGroup) {
        accessClauses.push(isNull(schema.ailockInteractions.toAilockId));
      }
      
      // We must have at least one access clause. The first one is unconditional.
      const combinedAccessClause = or(...accessClauses);

      if (!combinedAccessClause) {
        // This should be unreachable, but acts as a safeguard.
        return [];
      }

      return db.query.ailockInteractions.findMany({
        where: and(
          eq(schema.ailockInteractions.intentId, intentId),
          combinedAccessClause,
        ),
        with: {
          fromAilock: {
            columns: {
              name: true,
              level: true,
            }
          }
        },
        orderBy: [asc(schema.ailockInteractions.createdAt)],
      });
    });
    
    // Map the result to include sender's name and level
    // Note: The field in the db is `messageContent`, not `content`. We map it for client consistency.
    return interactions.map(i => ({
      id: i.id,
      fromAilockId: i.fromAilockId,
      toAilockId: i.toAilockId,
      intentId: i.intentId,
      sessionId: i.sessionId,
      parentInteractionId: i.parentInteractionId,
      chainId: i.chainId,
      priority: i.priority,
      status: i.status,
      createdAt: i.createdAt,
      readAt: i.readAt,
      respondedAt: i.respondedAt,
      type: i.interactionType,
      content: i.messageContent,
      fromAilockName: i.fromAilock?.name,
      fromAilockLevel: i.fromAilock?.level
    }));

  } catch (e: unknown) {
    console.error('Error fetching intent interactions:', e);
    const message = e instanceof Error ? e.message : 'An unknown error occurred';
    // Re-throw a more specific error to be caught by the main handler
    throw new Error(`Failed to fetch intent interactions: ${message}`);
  }
} 