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
