import { db } from '../db';
import { ailocks, ailockSkills, ailockXpHistory, ailockAchievements, intents, chatSessions } from '../schema';
import { eq, desc, count } from 'drizzle-orm';
import { SKILL_TREE, canUnlockSkill } from './skills';
import type { FullAilockProfile, AilockProfile, XpEventType, AilockSkill, AilockAchievement, XpEvent } from './shared';
import { getLevelInfo, XP_REWARDS } from './shared';

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


export class AilockService {
  
  async getOrCreateAilock(userId: string): Promise<FullAilockProfile> {
    const baseProfile = await this.findOrCreateBaseProfile(userId);
    
    const [skills, achievements, recentXpHistory] = await Promise.all([
      this.getSkills(baseProfile.id),
      this.getAchievements(baseProfile.id),
      this.getRecentXpHistory(baseProfile.id, 10)
    ]);
    
    const totalInteractions = await this.countInteractions(baseProfile.id);

    return {
      ...baseProfile,
      skills,
      achievements,
      recentXpHistory,
      totalInteractions,
    };
  }

  private async mapToAilockProfile(dbObject: any): Promise<AilockProfile> {
    return {
      id: dbObject.id,
      userId: dbObject.userId,
      name: dbObject.name,
      level: dbObject.level,
      xp: dbObject.xp,
      skillPoints: dbObject.skillPoints,
      avatarPreset: dbObject.avatarPreset,
      characteristics: {
        velocity: dbObject.velocity,
        insight: dbObject.insight,
        efficiency: dbObject.efficiency,
        economy: dbObject.economy,
        convenience: dbObject.convenience,
      },
      lastActiveAt: dbObject.lastActiveAt,
      createdAt: dbObject.createdAt,
      updatedAt: dbObject.updatedAt,
      totalIntentsCreated: dbObject.totalIntentsCreated,
      totalChatMessages: dbObject.totalChatMessages,
      totalSkillsUsed: dbObject.totalSkillsUsed,
    };
  }

  private async findOrCreateBaseProfile(userId: string): Promise<AilockProfile> {
    if (!db) {
      console.error('Database client (db) is not initialized in ailockService.');
      throw new Error('Database connection is not available.');
    }

    console.log(`[AilockService] Attempting to find profile for userId: ${userId} using Drizzle ORM.`);
    
    try {
      // Get existing profiles with retry
      let existingProfiles: any[] = [];
      let attempt = 0;
      const maxAttempts = 2;
      
      while (attempt < maxAttempts) {
        try {
          existingProfiles = await db.select()
            .from(ailocks)
            .where(eq(ailocks.userId, userId))
            .limit(1);
          break;
        } catch (dbError) {
          attempt++;
          console.log(`Ailock findOrCreateBaseProfile: DB attempt ${attempt} failed`, dbError);
          
          if (attempt >= maxAttempts) {
            throw dbError;
          }
          
          const { refreshDbConnection } = await import('../db');
          refreshDbConnection();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (existingProfiles.length > 0) {
        console.log(`[AilockService] Found existing profile for userId: ${userId}`);
        return this.mapToAilockProfile(existingProfiles[0]);
      } else {
        console.log(`[AilockService] No profile found for userId: ${userId}. Creating a new one.`);
        const newProfileData = {
          userId,
          name: 'Ailock',
          level: 1,
          xp: 0,
          skillPoints: 1,
          avatarPreset: 'default',
          characteristics: {
            velocity: 50,
            insight: 50,
            efficiency: 50,
            economy: 50,
            convenience: 50
          }
        };

        // Insert new profile with retry
        let newAilocks: any[] = [];
        attempt = 0;
        
        while (attempt < maxAttempts) {
          try {
            newAilocks = await db.insert(ailocks).values(newProfileData).returning();
            break;
          } catch (dbError) {
            attempt++;
            console.log(`Ailock findOrCreateBaseProfile: Insert attempt ${attempt} failed`, dbError);
            
            if (attempt >= maxAttempts) {
              throw dbError;
            }
            
            const { refreshDbConnection } = await import('../db');
            refreshDbConnection();
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        if (newAilocks.length === 0) {
          throw new Error('Failed to create a new Ailock profile.');
        }

        console.log(`[AilockService] New profile created successfully for userId: ${userId}`);
        return this.mapToAilockProfile(newAilocks[0]);
      }
    } catch (error) {
      console.error(`[AilockService] Error in findOrCreateBaseProfile for userId ${userId}:`, error);
      throw new Error('A database error occurred while fetching or creating the profile.');
    }
  }

  async gainXp(ailockId: string, eventType: XpEventType, context: Record<string, any> = {}) {
    const xpGained = XP_REWARDS[eventType] || 0;
    if (xpGained === 0) return { success: false, reason: 'No XP for this event.' };

    // Get ailock with retry mechanism
    let ailock: any[] = [];
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        ailock = await db.select().from(ailocks).where(eq(ailocks.id, ailockId)).limit(1);
        break;
      } catch (dbError) {
        attempt++;
        console.log(`Ailock gainXp: DB attempt ${attempt} failed`, dbError);
        
        if (attempt >= maxAttempts) {
          throw dbError;
        }
        
        // Refresh connection and wait before retry
        const { refreshDbConnection } = await import('../db');
        refreshDbConnection();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    if (ailock.length === 0) return { success: false, reason: 'Ailock not found.' };

    const currentProfile = ailock[0];
    const oldLevelInfo = getLevelInfo(currentProfile.xp ?? 0);

    const newXp = (currentProfile.xp ?? 0) + xpGained;
    const newLevelInfo = getLevelInfo(newXp);
    
    let leveledUp = false;
    let skillPointsGained = 0;
    
    if (newLevelInfo.level > oldLevelInfo.level) {
      leveledUp = true;
      skillPointsGained = newLevelInfo.level - oldLevelInfo.level; // 1 point per level
    }
    
    // Update profile in DB with retry
    let updatedAilocks: any[] = [];
    attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        updatedAilocks = await db.update(ailocks)
          .set({
            xp: newXp,
            level: newLevelInfo.level,
            skillPoints: (currentProfile.skillPoints ?? 0) + skillPointsGained,
            lastActiveAt: new Date()
          })
          .where(eq(ailocks.id, ailockId))
          .returning();
        break;
      } catch (dbError) {
        attempt++;
        console.log(`Ailock gainXp: Update attempt ${attempt} failed`, dbError);
        
        if (attempt >= maxAttempts) {
          throw dbError;
        }
        
        const { refreshDbConnection } = await import('../db');
        refreshDbConnection();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Log the XP event with retry
    attempt = 0;
    while (attempt < maxAttempts) {
      try {
        await db.insert(ailockXpHistory).values({
          ailockId,
          eventType,
          xpGained,
          description: `Gained ${xpGained} XP for ${eventType}.`,
          context,
        });
        break;
      } catch (dbError) {
        attempt++;
        console.log(`Ailock gainXp: Insert XP history attempt ${attempt} failed`, dbError);
        
        if (attempt >= maxAttempts) {
          // Don't fail the whole operation if XP history logging fails
          console.error('Failed to log XP history after retries, but continuing');
          break;
        }
        
        const { refreshDbConnection } = await import('../db');
        refreshDbConnection();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return {
      success: true,
      leveledUp,
      xpGained,
      newXp,
      newLevel: newLevelInfo.level,
      skillPointsGained,
      updatedProfile: updatedAilocks[0]
    };
  }

  async upgradeSkill(ailockId: string, skillId: string): Promise<boolean> {
    // Get profile with retry mechanism
    let profileResult: any[] = [];
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        profileResult = await db.select().from(ailocks).where(eq(ailocks.id, ailockId)).limit(1);
        break;
      } catch (dbError) {
        attempt++;
        console.log(`Ailock upgradeSkill: DB attempt ${attempt} failed`, dbError);
        
        if (attempt >= maxAttempts) {
          throw dbError;
        }
        
        const { refreshDbConnection } = await import('../db');
        refreshDbConnection();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    if(!profileResult.length) return false;
    const profile = profileResult[0];

    if ((profile.skillPoints ?? 0) < 1) {
      console.warn(`Ailock ${ailockId} has no skill points to upgrade.`);
      return false;
    }
    
    const userSkills = await this.getSkills(ailockId);
    const unlockedSkillIds = userSkills.map(s => s.skillId);

    const canUnlock = canUnlockSkill(skillId, unlockedSkillIds);
    if (!canUnlock) {
      console.warn(`Ailock ${ailockId} cannot unlock skill ${skillId} yet.`);
      return false;
    }

    const existingSkill = userSkills.find(s => s.skillId === skillId);

    if(!existingSkill){
        const skillDefinition = SKILL_TREE[skillId];
        if (!skillDefinition) return false;

        // Insert new skill with retry
        attempt = 0;
        while (attempt < maxAttempts) {
          try {
            await db.insert(ailockSkills).values({
                ailockId,
                skillId,
                skillName: skillDefinition.name,
                branch: skillDefinition.branch,
                currentLevel: 1,
                unlockedAt: new Date(),
            });
            break;
          } catch (dbError) {
            attempt++;
            console.log(`Ailock upgradeSkill: Insert skill attempt ${attempt} failed`, dbError);
            
            if (attempt >= maxAttempts) {
              throw dbError;
            }
            
            const { refreshDbConnection } = await import('../db');
            refreshDbConnection();
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
    } else {
        // Update existing skill with retry
        attempt = 0;
        while (attempt < maxAttempts) {
          try {
            await db.update(ailockSkills)
              .set({ currentLevel: (existingSkill.currentLevel ?? 0) + 1 })
              .where(eq(ailockSkills.id, existingSkill.id));
            break;
          } catch (dbError) {
            attempt++;
            console.log(`Ailock upgradeSkill: Update skill attempt ${attempt} failed`, dbError);
            
            if (attempt >= maxAttempts) {
              throw dbError;
            }
            
            const { refreshDbConnection } = await import('../db');
            refreshDbConnection();
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
    }

    // Update ailock skill points with retry
    attempt = 0;
    while (attempt < maxAttempts) {
      try {
        await db.update(ailocks)
          .set({ skillPoints: (profile.skillPoints ?? 0) - 1 })
          .where(eq(ailocks.id, ailockId));
        break;
      } catch (dbError) {
        attempt++;
        console.log(`Ailock upgradeSkill: Update ailock attempt ${attempt} failed`, dbError);
        
        if (attempt >= maxAttempts) {
          throw dbError;
        }
        
        const { refreshDbConnection } = await import('../db');
        refreshDbConnection();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return true;
  }

  async getSkills(ailockId: string): Promise<AilockSkill[]> {
    const skills = await db
      .select()
      .from(ailockSkills)
      .where(eq(ailockSkills.ailockId, ailockId));
    return skills as AilockSkill[];
  }

  async getAchievements(ailockId: string): Promise<AilockAchievement[]> {
    const achievements = await db
      .select()
      .from(ailockAchievements)
      .where(eq(ailockAchievements.ailockId, ailockId));
    
    return achievements.map(a => ({
        id: a.id,
        ailockId: a.ailockId,
        achievementId: a.achievementId,
        achievementName: a.name,
        achievementDescription: a.description || '',
        icon: a.icon || '🏆',
        rarity: (a.rarity as 'common' | 'rare' | 'epic' | 'legendary') || 'common',
        unlockedAt: a.unlockedAt || new Date(),
    }));
  }

  async getRecentXpHistory(ailockId: string, limit: number = 5): Promise<XpEvent[]> {
    const history = await db
      .select()
      .from(ailockXpHistory)
      .where(eq(ailockXpHistory.ailockId, ailockId))
      .orderBy(desc(ailockXpHistory.createdAt))
      .limit(limit);
    return history as XpEvent[];
  }

  private async countInteractions(ailockId: string): Promise<number> {
    const profile = await db.select({ userId: ailocks.userId }).from(ailocks).where(eq(ailocks.id, ailockId)).limit(1);
    if (!profile.length) return 0;
    const userId = profile[0].userId;

    const intentCountResult = await db.select({ value: count() }).from(intents).where(eq(intents.userId, userId));
    const messageCountResult = await db.select({ value: count() }).from(chatSessions).where(eq(chatSessions.userId, userId));
    
    const intentCount = intentCountResult[0]?.value ?? 0;
    const messageCount = messageCountResult[0]?.value ?? 0;
    
    return intentCount + messageCount;
  }

  private async checkAchievements(_ailockId: string): Promise<AilockAchievement[]> {
    // Placeholder for future achievement logic
    return [];
  }
}

export const ailockService = new AilockService();
