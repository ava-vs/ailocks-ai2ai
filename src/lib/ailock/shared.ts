// This file contains types, interfaces, and functions that are safe to use on both the client and server.
// It MUST NOT import any server-side only modules like 'db'.

// Base profile stored in the 'ailocks' table
export interface AilockProfile {
  id: string;
  userId: string;
  name: string;
  level: number;
  xp: number;
  skillPoints: number;
  avatarPreset: string;
  characteristics: {
    velocity: number;
    insight: number;
    efficiency: number;
    economy: number;
    convenience: number;
  };
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  totalIntentsCreated: number;
  totalChatMessages: number;
  totalSkillsUsed: number;
}

// Skill record from 'ailock_skills' table
export interface AilockSkill {
  id: string;
  ailockId: string;
  skillId: string;
  skillName: string;
  branch: string;
  currentLevel: number;
  usageCount: number;
  successRate: number; // 0 to 1
  lastUsedAt: Date | null;
  unlockedAt: Date | null;
}

// Achievement record from 'ailock_achievements' table
export interface AilockAchievement {
  id: string;
  ailockId: string;
  achievementId: string;
  achievementName: string;
  achievementDescription: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: Date;
}

// XP History record from 'ailock_xp_history'
export interface XpEvent {
  id: string;
  ailockId: string;
  eventType: string;
  xpGained: number;
  description: string;
  context: Record<string, any>;
  createdAt: Date;
}

// A complete profile with all related data for UI
export interface FullAilockProfile extends AilockProfile {
  skills: AilockSkill[];
  achievements: AilockAchievement[];
  recentXpHistory: XpEvent[];
  totalInteractions: number;
}

export interface TaskDefinition {
  id: string;
  name: string;
  description: string | null;
  eventTypeTrigger: string;
  triggerCountGoal: number;
  xpReward: number;
  category: string | null;
  unlockLevelRequirement: number | null;
}

export interface UserTask {
  id: string;
  userId: string;
  taskId: string;
  assignedDate: string;
  progressCount: number;
  status: string;
  completedAt: Date | null;
  claimedAt: Date | null;
  // Joined definition for convenience
  definition?: TaskDefinition;
}

export type XpEventType = 
  | 'chat_message_sent'
  | 'voice_message_sent'
  | 'intent_created'
  | 'intent_deleted'
  | 'skill_used_successfully'
  | 'achievement_unlocked'
  | 'project_started'
  | 'project_completed'
  | 'first_login_today'
  // AI2AI Interaction Events
  | 'ailock_message_sent'
  | 'ailock_message_helpful'
  | 'intent_clarification_provided'
  | 'collaboration_initiated'
  | 'collaboration_success'
  | 'daily_task_completed';

export const XP_REWARDS: Record<XpEventType, number> = {
  chat_message_sent: 1,
  voice_message_sent: 2,
  intent_created: 10,
  intent_deleted: -2,
  skill_used_successfully: 15,
  achievement_unlocked: 50,
  project_started: 25,
  project_completed: 100,
  first_login_today: 10,
  // AI2AI
  ailock_message_sent: 2,
  ailock_message_helpful: 5,
  intent_clarification_provided: 20,
  collaboration_initiated: 30,
  collaboration_success: 150,
  daily_task_completed: 0, // XP is awarded dynamically from the task definition
};

// --- Client-Safe Functions ---

// XP progression logic
export function calculateXpForNextLevel(level: number): number {
  if (level >= 20) return 0; // Max level
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

// Calculate total XP needed to reach a specific level
export function calculateTotalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += calculateXpForNextLevel(i);
  }
  return total;
}

// Calculate level info from current XP
export function getLevelInfo(currentXp: number) {
  let level = 1;
  let totalXpForCurrentLevel = 0;
  
  while (level < 20) {
    const xpNeededForNextLevel = calculateXpForNextLevel(level);
    const nextLevelThreshold = totalXpForCurrentLevel + xpNeededForNextLevel;
    
    if (currentXp >= nextLevelThreshold) {
      totalXpForCurrentLevel += xpNeededForNextLevel;
      level++;
    } else {
      break;
    }
  }
  
  const xpNeededForNextLevel = level < 20 ? calculateXpForNextLevel(level) : 0;
  const progressXp = currentXp - totalXpForCurrentLevel;
  
  return {
    level,
    currentXp,
    totalXpForCurrentLevel,
    xpNeededForNextLevel,
    progressXp,
    xpToNextLevel: Math.max(0, xpNeededForNextLevel - progressXp),
    progressPercentage: xpNeededForNextLevel > 0 ? Math.min((progressXp / xpNeededForNextLevel) * 100, 100) : 100
  };
}

// Get skill effect based on skill ID and level
export function getSkillEffect(skillId: string, level: number): string {
  // This function would normally be in skills.ts, but we're adding it here
  // to avoid circular dependencies and make it available to both client and server
  const skillEffects: Record<string, Record<number, string>> = {
    semantic_search: {
      1: "Basic keyword and category matching.",
      2: "Enabled semantic understanding for deeper context.",
      3: "AI predicts search intent for hyper-relevant results."
    },
    deep_research: {
      1: "Analyzes up to 3 external sources for reports.",
      2: "Cross-references up to 10 sources and identifies patterns.",
      3: "Generates detailed reports with cited sources and novel insights."
    },
    // Add other skills as needed
  };

  return skillEffects[skillId]?.[level] || "No effect at this level.";
}