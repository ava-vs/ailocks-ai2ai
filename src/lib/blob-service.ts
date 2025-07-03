import { getDeployStore, Store } from '@netlify/blobs';

export interface ChatContext {
  sessionId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    mode: string;
  }>;
  metadata: {
    mode: string;
    language: string;
    location: {
      country: string;
      city: string;
      timezone: string;
    };
    startTime: Date;
    lastActivity: Date;
    messageCount: number;
  };
}

export class ChatBlobService {
  // The store is no longer initialized here.
  // We will get it on-demand inside each method.
  
  private getStoreInstance(): Store {
    // This function will be called from within the Netlify function handlers,
    // ensuring the execution context is available.
    try {
      return getDeployStore('chat-contexts');
    } catch (error) {
      console.error('Failed to initialize Netlify Blobs store:', error);
      throw new Error('Blob storage unavailable');
    }
  }

  async saveContext(sessionId: string, context: ChatContext): Promise<void> {
    try {
      const store = this.getStoreInstance();
      
      // Ensure dates are properly serialized
      const serializedContext = {
        ...context,
        messages: context.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
        })),
        metadata: {
          ...context.metadata,
          startTime: context.metadata.startTime.toISOString(),
          lastActivity: new Date().toISOString()
        }
      };

      await store.setJSON(sessionId, serializedContext);
    } catch (error) {
      console.error('Failed to save chat context:', error);
      // Don't throw error to prevent breaking the chat flow
      // Instead, log the error and continue
    }
  }

  async getContext(sessionId: string): Promise<ChatContext | null> {
    try {
      const store = this.getStoreInstance();
      const context = await store.get(sessionId, { type: 'json' }) as any;
      
      if (!context) {
        return null;
      }

      // Deserialize dates
      const deserializedContext: ChatContext = {
        ...context,
        messages: context.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        metadata: {
          ...context.metadata,
          startTime: new Date(context.metadata.startTime),
          lastActivity: new Date(context.metadata.lastActivity)
        }
      };

      return deserializedContext;
    } catch (error) {
      console.error('Failed to get chat context:', error);
      return null;
    }
  }

  async deleteContext(sessionId: string): Promise<void> {
    try {
      const store = this.getStoreInstance();
      await store.delete(sessionId);
    } catch (error) {
      console.error('Failed to delete chat context:', error);
      throw new Error('Failed to delete chat context');
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const store = this.getStoreInstance();
      const { blobs } = await store.list();
      return blobs.map(blob => blob.key);
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  async createSession(mode: string, language: string, location: any): Promise<string> {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const context: ChatContext = {
      sessionId,
      messages: [],
      metadata: {
        mode,
        language,
        location,
        startTime: new Date(),
        lastActivity: new Date(),
        messageCount: 0
      }
    };

    try {
      await this.saveContext(sessionId, context);
    } catch (error) {
      console.error('Failed to save initial session context:', error);
      // Continue anyway - session will work without persistence
    }
    
    return sessionId;
  }

  async restoreSession(sessionId: string): Promise<ChatContext | null> {
    const context = await this.getContext(sessionId);
    
    if (context) {
      // Update last activity
      context.metadata.lastActivity = new Date();
      await this.saveContext(sessionId, context);
    }
    
    return context;
  }

  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      // List all sessions to check their age
      const sessionKeys = await this.listSessions();
      let cleanedCount = 0;
      
      for (const sessionId of sessionKeys) {
        const context = await this.getContext(sessionId);
        if (context && context.metadata.lastActivity < cutoffDate) {
          await this.deleteContext(sessionId);
          cleanedCount++;
        }
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      return 0;
    }
  }
}