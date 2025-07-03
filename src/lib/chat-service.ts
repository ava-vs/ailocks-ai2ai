import { db } from './db';
import { chatSessions, users } from './schema';
import { eq, and, desc } from 'drizzle-orm';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  mode: string;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  userId: string;
  blobKey: string;
  mode: string;
  language: string;
  isActive: boolean;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export class ChatService {
  // Simplified write locks - just prevent simultaneous writes to same blob
  private writeLocks = new Set<string>();

  async createSession(userId: string, mode: string, language: string): Promise<string> {
    try {
      // Validate userId before proceeding
      if (!userId || userId === 'loading' || userId === 'anonymous' || !this.isValidUUID(userId)) {
        console.warn('⚠️ Invalid or temporary userId provided:', userId);
        throw new Error(`Invalid userId: ${userId}. Please ensure user data is loaded before creating session.`);
      }

      // First ensure the user exists in the database
      await this.ensureUserExists(userId);
      
      const blobKey = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const [session] = await db.insert(chatSessions).values({
        userId,
        blobKey,
        mode,
        language,
        isActive: true
      }).returning();

      console.log('✅ Chat session created in database:', session.id);
      return session.id;
    } catch (error) {
      console.error('❌ Failed to create chat session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    try {
      // Check if user exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (existingUser.length === 0) {
        throw new Error(`User not found: ${userId}. Please ensure demo users are seeded in database.`);
      }
      
      console.log('✅ User exists in database:', existingUser[0].name);
    } catch (error) {
      console.error('❌ Failed to ensure user exists:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      // Validate UUID format
      if (!this.isValidUUID(sessionId)) {
        console.warn('⚠️ Invalid UUID format for session:', sessionId);
        return null;
      }

      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId));

      if (!session) {
        console.warn('⚠️ Session not found in database:', sessionId);
        return null;
      }

      // Get messages from blob storage
      const messages = await this.getSessionMessages(session.blobKey || '');

      return {
        id: session.id,
        userId: session.userId || '',
        blobKey: session.blobKey || '',
        mode: session.mode || 'researcher',
        language: session.language || 'en',
        isActive: session.isActive || true,
        messages,
        createdAt: session.createdAt || new Date(),
        updatedAt: session.updatedAt || new Date()
      };
    } catch (error) {
      console.error('❌ Failed to get chat session:', error);
      return null;
    }
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async saveMessage(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      console.log('💾 Attempting to save message for session:', sessionId, 'message role:', message.role);
      
      // Validate UUID format
      if (!this.isValidUUID(sessionId)) {
        console.warn('⚠️ Invalid UUID format, cannot save message for session:', sessionId);
        return;
      }
      
      // Get the session from database
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId));

      if (!session) {
        console.warn('⚠️ Session not found in database, cannot save message:', sessionId);
        return;
      }

      console.log('✅ Session found, blob key:', session.blobKey);

      // Sequential operations (no transactions with neon-http driver)
      try {
        // 1. Add message to blob first (with fresh etag protection)
        await this.addMessageToBlob(session.blobKey || '', message);

        // 2. Update session metadata after successful blob operation  
        await db.update(chatSessions)
          .set({ 
            updatedAt: new Date(),
            isActive: true 
          })
          .where(eq(chatSessions.id, sessionId));
      } catch (error) {
        console.error('❌ Failed to save message or update session:', error);
        throw error; // Re-throw to maintain error handling
      }

      console.log('✅ Message saved successfully for session:', sessionId);
    } catch (error) {
      console.error('❌ Failed to save message:', error);
      // Don't throw error to prevent breaking chat flow
    }
  }

  async getUserSessions(userId: string, limit: number = 10): Promise<ChatSession[]> {
    try {
      // Validate UUID format
      if (!this.isValidUUID(userId)) {
        console.warn('⚠️ Invalid UUID format for user:', userId);
        return [];
      }

      const sessions = await db
        .select()
        .from(chatSessions)
        .where(and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.isActive, true)
        ))
        .orderBy(desc(chatSessions.updatedAt))
        .limit(limit);

      console.log(`📋 Found ${sessions.length} sessions for user:`, userId);

      const sessionsWithMessages = await Promise.all(
        sessions.map(async (session) => {
          const messages = await this.getSessionMessages(session.blobKey || '');
          return {
            id: session.id,
            userId: session.userId || '',
            blobKey: session.blobKey || '',
            mode: session.mode || 'researcher',
            language: session.language || 'en',
            isActive: session.isActive || true,
            messages,
            createdAt: session.createdAt || new Date(),
            updatedAt: session.updatedAt || new Date()
          };
        })
      );

      return sessionsWithMessages;
    } catch (error) {
      console.error('❌ Failed to get user sessions:', error);
      return [];
    }
  }

  async deactivateSession(sessionId: string): Promise<void> {
    try {
      // Validate UUID format
      if (!this.isValidUUID(sessionId)) {
        console.warn('⚠️ Invalid UUID format for session:', sessionId);
        return;
      }

      await db
        .update(chatSessions)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(chatSessions.id, sessionId));

      console.log('✅ Session deactivated:', sessionId);
    } catch (error) {
      console.error('❌ Failed to deactivate session:', error);
    }
  }

  private async addMessageToBlob(blobKey: string, newMessage: ChatMessage, attempt: number = 1): Promise<void> {
    if (!blobKey) {
      throw new Error('Blob key is required');
    }

    if (attempt > 3) {
      throw new Error('Max retries reached for blob write operation');
    }

    // Simple lock to prevent parallel writes to same blob
    if (this.writeLocks.has(blobKey)) {
      console.log(`⏳ Waiting for ongoing write to complete for blob: ${blobKey}`);
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
      return this.addMessageToBlob(blobKey, newMessage, attempt + 1);
    }

    this.writeLocks.add(blobKey);
    
    try {
      console.log(`🔄 Adding message to blob (attempt ${attempt}):`, blobKey, 'role:', newMessage.role);
      
      const { getStore } = await import('@netlify/blobs');
      const store = getStore('chat-messages');
      
      // ALWAYS get fresh data with metadata - CRITICAL FIX
      const result = await store.getWithMetadata(blobKey, { 
        type: 'json',
        consistency: 'strong' // Guarantee fresh data
      });
      
      const existingMessages: any[] = result?.data || [];
      const etag = result?.etag; // Fresh etag for this attempt
      
      console.log(`📊 Blob state (attempt ${attempt}):`, {
        blobKey: blobKey.slice(-8),
        messageRole: newMessage.role,
        messageId: newMessage.id.slice(-8),
        existingCount: existingMessages.length,
        existingRoles: existingMessages.map(m => `${m.role}:${m.id.slice(-8)}`),
        freshEtag: etag ? etag.slice(-8) : 'null'
      });
      
      // Check for duplicate messages
      const messageExists = existingMessages.some((m: any) => m.id === newMessage.id);
      if (messageExists) {
        console.log('⚠️ Message already exists, skipping save:', newMessage.id.slice(-8));
        return;
      }
      
      // Limit message history to prevent blob from growing too large
      const MAX_MESSAGES = 500;
      const messagesToKeep = existingMessages.slice(-MAX_MESSAGES + 1);
      
      const updatedMessages = [
        ...messagesToKeep,
        {
          id: newMessage.id,
          role: newMessage.role,
          content: newMessage.content,
          mode: newMessage.mode,
          metadata: newMessage.metadata || {},
          timestamp: newMessage.timestamp.toISOString()
        }
      ];

      // Save with FRESH etag - prevents stale etag issues
      if (etag) {
        await store.setJSON(blobKey, updatedMessages, { onlyIfMatch: etag });
      } else {
        await store.setJSON(blobKey, updatedMessages);
      }
      
      console.log(`✅ Message added to blob (attempt ${attempt}). Previous: ${existingMessages.length}, New total: ${updatedMessages.length}, Added: ${newMessage.role}:${newMessage.id.slice(-8)}`);
      
      // Log if messages were trimmed
      if (existingMessages.length >= MAX_MESSAGES) {
        console.log(`📦 Message history trimmed: kept ${updatedMessages.length} of ${existingMessages.length + 1} messages`);
      }
      
    } catch (error: any) {
      if (error.name === 'BlobEtagMismatchError' && attempt < 3) {
        // Handle conflict with fresh etag retry and exponential backoff
        const delay = 100 * attempt; // 100ms, 200ms, 300ms
        console.warn(`⚠️ Blob conflict detected (attempt ${attempt}/3), retrying after ${delay}ms for ${newMessage.role}:${newMessage.id.slice(-8)}...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.addMessageToBlob(blobKey, newMessage, attempt + 1);
      } else {
        // Either not an etag error or max retries exceeded
        console.error(`❌ Failed to save message after ${attempt} attempts:`, error);
        throw error;
      }
    } finally {
      // Always remove lock
      this.writeLocks.delete(blobKey);
    }
  }

  private async getSessionMessages(blobKey: string): Promise<ChatMessage[]> {
    // Handle null/empty blobKey
    if (!blobKey) {
      console.warn('⚠️ Empty blob key, returning empty messages');
      return [];
    }

    try {
      console.log('📥 Attempting to load messages from blob:', blobKey);
      
      // Use getStore for automatic configuration in Netlify Functions
      const { getStore } = await import('@netlify/blobs');
      const store = getStore('chat-messages');
      
      // Use getWithMetadata with strong consistency for guaranteed fresh data
      const result = await store.getWithMetadata(blobKey, { 
        type: 'json',
        consistency: 'strong'
      });
      const messages = result?.data;
      
      // Handle missing data properly
      if (!messages) {
        console.log('📭 No messages found in blob storage');
        return [];
      }
      
      if (Array.isArray(messages)) {
        console.log(`✅ Loaded ${messages.length} messages from blob storage`);
        return (messages as any[]).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
      
      console.log('📭 No valid messages array found');
      return [];
    } catch (error) {
      console.error('❌ Blob read error:', error);
      return [];
    }
  }

  async cleanupOldSessions(): Promise<number> {
    try {
      // For now, just return 0 - we can implement proper cleanup later
      console.log('✅ Cleanup function called (not implemented yet)');
      return 0;
    } catch (error) {
      console.error('❌ Failed to cleanup old sessions:', error);
      return 0;
    }
  }
}

export const chatService = new ChatService();
