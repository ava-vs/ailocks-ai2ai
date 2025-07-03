export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  mode: AIMode;
}

export type AIMode = 'researcher' | 'creator' | 'analyst';

export interface UserLocation {
  country: string;
  city: string;
  timezone: string;
  isDefault: boolean;
}

export interface Intent {
  id: string;
  title: string;
  description: string;
  category: string;
  targetCountry?: string;
  requiredSkills: string[];
  status: 'active' | 'completed' | 'pending';
  createdAt: Date;
}

export interface ContextAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  mode: AIMode;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  mode: AIMode;
  isActive: boolean;
  createdAt: Date;
}