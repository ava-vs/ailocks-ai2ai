import { db, withDbRetry } from '../db';
import { ailocks, ailockSkills, ailockXpHistory, ailockAchievements, intents, chatSessions, userTasks, taskDefinitions } from '../schema';
import { eq, desc, count, and, sql, inArray, notInArray, gte, lte } from 'drizzle-orm';
import { SKILL_TREE, canUnlockSkill } from './skills';
import type { FullAilockProfile, AilockProfile, XpEventType, AilockSkill, AilockAchievement, XpEvent, UserTask, TaskDefinition } from './shared';
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
  
  /**
   * Возвращает полный профиль Ailock по userId пользователя, включая навыки и достижения
   */
  async getFullAilockProfileByUserId(userId: string): Promise<FullAilockProfile> {
    // Находим базовый профиль по userId
    const baseProfile = await this.getAilockProfileByUserId(userId);
    
    // Добавляем дополнительные данные к профилю
    const [skills, achievements, recentXpHistory] = await Promise.all([
      this.getSkills(baseProfile.id),
      this.getAchievements(baseProfile.id),
      this.getRecentXpHistory(baseProfile.id, 10)
    ]);
    
    return this.buildFullProfile(baseProfile, skills, achievements, recentXpHistory);
  }
  
  /**
   * Возвращает полный профиль Ailock по его ID, включая навыки и достижения
   */
  async getFullAilockProfileById(ailockId: string): Promise<FullAilockProfile> {
    // Находим базовый профиль по ID
    const baseProfile = await this.getAilockProfileById(ailockId);
    
    // Добавляем дополнительные данные к профилю
    const [skills, achievements, recentXpHistory] = await Promise.all([
      this.getSkills(baseProfile.id),
      this.getAchievements(baseProfile.id),
      this.getRecentXpHistory(baseProfile.id, 10)
    ]);
    
    return this.buildFullProfile(baseProfile, skills, achievements, recentXpHistory);
  }
  
  /**
   * Вспомогательная функция для построения полного профиля из базового профиля и дополнительных данных
   */
  private buildFullProfile(baseProfile: AilockProfile, skills: AilockSkill[], achievements: AilockAchievement[], recentXpHistory: XpEvent[]): FullAilockProfile {
    // Подсчет общего числа взаимодействий
    const totalInteractions = recentXpHistory.filter(x => 
      x.eventType === 'sent_message' || x.eventType === 'received_message' || 
      x.eventType === 'responded_to_message'
    ).length;
    
    return {
      ...baseProfile,
      skills,
      achievements,
      recentXpHistory,
      totalInteractions
    };
  }
  
  /**
   * Находит профиль Ailock по userId
   * @deprecated Используйте getFullAilockProfileByUserId вместо этого метода
   */
  async getOrCreateAilock(userId: string): Promise<FullAilockProfile> {
    // Находим профиль по userId
    const baseProfile = await this.getAilockProfileByUserId(userId);
    
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

  /**
   * Находит профиль Ailock по userId пользователя
   */
  async getAilockProfileByUserId(userId: string): Promise<AilockProfile> {
    if (!db) {
      console.error('Database client (db) is not initialized in ailockService.');
      throw new Error('Database connection is not available.');
    }

    console.log(`[AilockService] Attempting to find ailock profile by userId: ${userId} using Drizzle ORM.`);
    
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
          console.log(`Ailock getAilockProfileByUserId: DB attempt ${attempt} failed`, dbError);
          
          if (attempt >= maxAttempts) {
            throw dbError;
          }
          
          const { refreshDbConnection } = await import('../db');
          refreshDbConnection();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (existingProfiles.length > 0) {
        console.log(`[AilockService] Found existing ailock profile with userId: ${userId}, ailockId: ${existingProfiles[0].id}`);
        return this.mapToAilockProfile(existingProfiles[0]);
      } else {
        console.log(`[AilockService] No ailock profile found for userId: ${userId}.`);
        throw new Error(`Ailock profile not found for user ${userId}. Please contact support.`);
      }
    } catch (error) {
      console.error(`[AilockService] Error in getAilockProfileByUserId for userId ${userId}:`, error);
      throw new Error('A database error occurred while fetching the profile.');
    }
  }

  /**
   * Returns existing ailock profile by its ID
   */
  async getAilockProfileById(ailockId: string): Promise<AilockProfile> {
    if (!db) {
      console.error('Database client (db) is not initialized in ailockService.');
      throw new Error('Database connection is not available.');
    }

    console.log(`[AilockService] Attempting to find ailock profile by ID: ${ailockId} using Drizzle ORM.`);
    
    try {
      // Get existing profiles with retry
      let existingProfiles: any[] = [];
      let attempt = 0;
      const maxAttempts = 2;
      
      while (attempt < maxAttempts) {
        try {
          existingProfiles = await db.select()
            .from(ailocks)
            .where(eq(ailocks.id, ailockId))
            .limit(1);
          break;
        } catch (dbError) {
          attempt++;
          console.log(`Ailock getBaseProfile: DB attempt ${attempt} failed`, dbError);
          
          if (attempt >= maxAttempts) {
            throw dbError;
          }
          
          const { refreshDbConnection } = await import('../db');
          refreshDbConnection();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (existingProfiles.length > 0) {
        console.log(`[AilockService] Found existing ailock profile with ID: ${ailockId}`);
        return this.mapToAilockProfile(existingProfiles[0]);
      } else {
        console.log(`[AilockService] No ailock profile found with ID: ${ailockId}.`);
        throw new Error(`Ailock profile not found with ID ${ailockId}. Please contact support.`);
      }
    } catch (error) {
      console.error(`[AilockService] Error in getAilockProfileById for ID ${ailockId}:`, error);
      throw new Error('A database error occurred while fetching the profile.');
    }
  }

  async gainXp(ailockId: string, eventType: XpEventType, context: Record<string, any> = {}) {
    const xpGained = context.xpGained || XP_REWARDS[eventType] || 0;
    if (xpGained === 0 && eventType !== 'daily_task_completed') return { success: false, reason: 'No XP for this event.' };

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
    
    // Don't update task progress for task completion events to avoid loops
    if (eventType !== 'daily_task_completed') {
      const ailockForTask = await db.query.ailocks.findFirst({ where: eq(ailocks.id, ailockId), columns: { userId: true } });
      if (ailockForTask) {
        this.updateTaskProgress(ailockForTask.userId, eventType).catch(err => {
          console.error(`[AilockService] Failed to update task progress for user ${ailockForTask.userId}`, err);
        });
      }
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

  // ============== Daily Task Service Logic ==============

  async getTasksForUser(userId: string): Promise<UserTask[]> {
    const today = new Date().toISOString().slice(0, 10);

    let tasksResult = await db.query.userTasks.findMany({
      where: and(eq(userTasks.userId, userId), eq(userTasks.assignedDate, today)),
      with: {
        taskDefinition: true
      }
    });

    if (tasksResult.length === 0) {
      await this._assignTasksForUser(userId, today);
      tasksResult = await db.query.userTasks.findMany({
        where: and(eq(userTasks.userId, userId), eq(userTasks.assignedDate, today)),
        with: {
          taskDefinition: true
        }
      });
    }

    return tasksResult.map((t): UserTask => ({
      id: t.id,
      userId: t.userId,
      taskId: t.taskId,
      assignedDate: t.assignedDate,
      progressCount: t.progressCount || 0,
      status: t.status || 'in_progress',
      completedAt: t.completedAt,
      claimedAt: t.claimedAt,
      definition: t.taskDefinition,
    }));
  }

  private async _assignTasksForUser(userId: string, today: string) {
    const ailockProfile = await this.getFullAilockProfileByUserId(userId);

    // 1. Assign onboarding tasks if needed
    const completedOnboardingTasks = await db.select({ taskId: userTasks.taskId })
      .from(userTasks)
      .leftJoin(taskDefinitions, eq(userTasks.taskId, taskDefinitions.id))
      .where(and(
        eq(userTasks.userId, userId),
        eq(taskDefinitions.category, 'onboarding'),
        eq(userTasks.status, 'completed')
      ));

    const completedOnboardingIds = completedOnboardingTasks.map(t => t.taskId);

    const onboardingTasksToAssign = await db.select()
      .from(taskDefinitions)
      .where(and(
        eq(taskDefinitions.category, 'onboarding'),
        eq(taskDefinitions.isActive, true),
        completedOnboardingIds.length > 0 ? notInArray(taskDefinitions.id, completedOnboardingIds) : sql`true`
      ))
      .orderBy(taskDefinitions.unlockLevelRequirement)
      .limit(2);

    // 2. Assign daily tasks
    const dailyTasksToAssign = await db.select()
      .from(taskDefinitions)
      .where(and(
        eq(taskDefinitions.category, 'daily'),
        eq(taskDefinitions.isActive, true),
        lte(taskDefinitions.unlockLevelRequirement, ailockProfile.level)
      ))
      .orderBy(sql`RANDOM()`)
      .limit(3);
    
    const allTasksToAssign = [...onboardingTasksToAssign, ...dailyTasksToAssign];

    if (allTasksToAssign.length > 0) {
      const newTasks = allTasksToAssign.map(task => ({
        userId,
        taskId: task.id,
        assignedDate: today,
        status: 'in_progress',
        progressCount: 0,
      }));
      await db.insert(userTasks).values(newTasks).onConflictDoNothing();
      console.log(`[AilockService] Assigned ${newTasks.length} tasks to user ${userId} for ${today}.`);
    }
  }

  async updateTaskProgress(userId: string, eventType: XpEventType) {
    const today = new Date().toISOString().slice(0, 10);

    const activeTasks = await db.query.userTasks.findMany({
      where: and(
        eq(userTasks.userId, userId),
        eq(userTasks.status, 'in_progress'),
        eq(userTasks.assignedDate, today)
      ),
      with: {
        taskDefinition: true
      }
    });

    const tasksToUpdate = activeTasks.filter(
      (t) => t.taskDefinition && t.taskDefinition.eventTypeTrigger === eventType
    );

    if (tasksToUpdate.length === 0) {
      return;
    }

    const taskIdsToIncrement = tasksToUpdate.map(t => t.id);
    await db.update(userTasks)
      .set({ progressCount: sql`${userTasks.progressCount} + 1` })
      .where(inArray(userTasks.id, taskIdsToIncrement));
    
    // Check for completion
    const updatedTasks = await db.query.userTasks.findMany({
        where: inArray(userTasks.id, taskIdsToIncrement),
        with: { taskDefinition: true }
    });

    for (const task of updatedTasks) {
      const definition = task.taskDefinition;
      if (!definition) continue;

      if ((task.progressCount || 0) >= definition.triggerCountGoal) {
        // Prevent re-completion
        if (task.status === 'completed') continue;

        await db.update(userTasks)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(userTasks.id, task.id));
        
        console.log(`[AilockService] Task '${definition.name}' completed for user ${userId}.`);
        
        // Find ailockId for the user
        const ailock = await db.query.ailocks.findFirst({where: eq(ailocks.userId, userId), columns: { id: true }});
        if (!ailock) continue;

        // Award XP
        await this.gainXp(ailock.id, 'daily_task_completed', { 
          xpGained: definition.xpReward,
          taskId: task.taskId,
          taskName: definition.name,
        });
        
        // TODO: Send real-time notification to the user
      }
    }
  }
}

export const ailockService = new AilockService();
