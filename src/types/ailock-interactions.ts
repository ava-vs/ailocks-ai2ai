export interface AilockInteraction {
  id: string;
  fromAilockId: string;
  toAilockId: string;
  sessionId?: string; // Связь с существующими чатами
  intentId?: string;  // Связь с интентами
  type: 'clarify_intent' | 'provide_info' | 'collaboration_request' | 'response';
  content: string;
  classification?: MessageClassification;
  moderation?: ModerationResult;
  parentId?: string; // Для цепочек сообщений
  chainId?: string;  // Для Smart Chains
  priority?: number; // 1-100
  status: 'sent' | 'delivered' | 'read' | 'responded' | 'archived';
  createdAt: Date;
  readAt?: Date;
  respondedAt?: Date;
  fromAilockName?: string;
  fromAilockLevel?: number;
  intentTitle?: string;
}

export interface MessageClassification {
  confidence: number;
  suggestedSkills: string[];
  urgency: 'low' | 'medium' | 'high';
  category: string;
  requiresResponse: boolean;
  estimatedResponseTime?: string;
  complexity?: number;
  geoPriority?: 'local' | 'regional' | 'global';
}

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
  confidence: number;
  categories?: string[];
}

export interface AilockCandidate {
  ailock: any; // Will reference actual Ailock type
  scores: {
    skill: number;
    location: number;
    availability: number;
    reputation: number;
  };
  totalScore: number;
  estimatedResponseTime?: string;
}

export interface AilockSkillLevel {
  skillId: string;
  skillName: string;
  currentLevel: number;
  branch: string;
}

export interface InteractionContext {
  userLocation?: {
    country: string;
    city: string;
    timezone: string;
  };
  intent?: any; // Will reference actual Intent type
  conversationHistory?: AilockInteraction[];
  urgency?: 'low' | 'medium' | 'high';
}

export interface SmartTemplate {
  id: string;
  type: 'clarify_intent' | 'collaboration_offer' | 'expertise_share';
  template: string;
  requiredContext: string[];
  personalizationLevel: 'basic' | 'advanced' | 'expert';
}

// Events for real-time notifications
export interface AilockNotificationEvent {
  type: 'ailock_notification';
  interaction: {
    id: string;
    fromAilock: {
      id: string;
      name: string;
      level: number;
      avatar?: string;
    };
    content: string;
    intentId?: string;
    createdAt: Date;
  };
}

// Voice agent command interface
export interface VoiceAilockCommand {
  command: 'send_ailock_message' | 'check_ailock_inbox' | 'respond_to_ailock';
  parameters: {
    targetAilockId?: string;
    message?: string;
    intentId?: string;
    interactionId?: string;
  };
}

// API Response types
export interface SendInteractionResponse {
  success: boolean;
  interaction: AilockInteraction;
  estimatedResponseTime?: string;
  suggestedNextActions?: string[];
}

export interface InboxResponse {
  interactions: AilockInteraction[];
  unreadCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface InteractionStatsResponse {
  totalSent: number;
  totalReceived: number;
  totalResponded: number;
  averageResponseTime: string;
  topCollaborators: Array<{
    ailockId: string;
    ailockName: string;
    interactionCount: number;
  }>;
} 