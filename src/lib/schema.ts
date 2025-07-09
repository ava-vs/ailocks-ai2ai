import {
  pgTable,
  text,
  varchar,
  uuid,
  timestamp,
  pgEnum,
  vector,
  jsonb,
  integer,
  boolean,
  primaryKey,
  date,
  unique,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  country: varchar('country', { length: 2 }),
  city: varchar('city', { length: 255 }),
  timezone: varchar('timezone', { length: 50 }),
  languages: text('languages').array(),
  // Authentication fields
  passwordHash: varchar('password_hash', { length: 255 }),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  blobKey: varchar('blob_key', { length: 255 }).unique(),
  mode: varchar('mode', { length: 50 }),
  language: varchar('language', { length: 10 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const intents = pgTable('intents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  targetCountry: varchar('target_country', { length: 2 }),
  targetCity: varchar('target_city', { length: 255 }),
  requiredSkills: text('required_skills').array(),
  budget: integer('budget'),
  timeline: varchar('timeline', { length: 255 }),
  priority: varchar('priority', { length: 20 }).default('normal'),
  status: varchar('status', { length: 20 }).default('active'),
  // Vector embedding support
  embedding: vector('embedding', { dimensions: 1536 }),
  embeddingModel: varchar('embedding_model', { length: 50 }).default('text-embedding-3-small'),
  embeddingGeneratedAt: timestamp('embedding_generated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const userInWorkIntents = pgTable('user_in_work_intents', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  intentId: uuid('intent_id').notNull().references(() => intents.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.intentId] }),
  };
});

export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  skills: text('skills').array(),
  price: integer('price'), // in cents
  currency: varchar('currency', { length: 3 }).default('USD'),
  locationFlexibility: varchar('location_flexibility', { length: 20 }).default('flexible'),
  status: varchar('status', { length: 20 }).default('active'),
  // Vector embedding support
  embedding: vector('embedding', { dimensions: 1536 }),
  embeddingModel: varchar('embedding_model', { length: 50 }).default('text-embedding-3-small'),
  embeddingGeneratedAt: timestamp('embedding_generated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const smartChains = pgTable('smart_chains', {
  id: uuid('id').defaultRandom().primaryKey(),
  rootIntentId: uuid('root_intent_id').references(() => intents.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('planning'),
  totalSteps: integer('total_steps').default(0),
  completedSteps: integer('completed_steps').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const chainSteps = pgTable('chain_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  chainId: uuid('chain_id').references(() => smartChains.id),
  stepNumber: integer('step_number').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('pending'),
  assignedUserId: uuid('assigned_user_id').references(() => users.id),
  estimatedHours: integer('estimated_hours'),
  requiredSkills: text('required_skills').array(),
  deliverable: text('deliverable'),
  dependencies: text('dependencies').array(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Ailock Evolution System Tables
export const ailocks = pgTable('ailocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).unique().notNull(),
  name: varchar('name', { length: 255 }).default('Ailock'),
  level: integer('level').default(1),
  xp: integer('xp').default(0),
  skillPoints: integer('skill_points').default(0),
  // Characteristics
  velocity: integer('velocity').default(10),
  insight: integer('insight').default(10),
  efficiency: integer('efficiency').default(10),
  economy: integer('economy').default(10),
  convenience: integer('convenience').default(10),
  // Personality & Avatar
  avatarPreset: varchar('avatar_preset', { length: 50 }).default('robot'),
  // Progress tracking (can be deprecated if derived from history)
  totalIntentsCreated: integer('total_intents_created').default(0),
  totalChatMessages: integer('total_chat_messages').default(0),
  totalSkillsUsed: integer('total_skills_used').default(0),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const ailockSkills = pgTable('ailock_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  ailockId: uuid('ailock_id').references(() => ailocks.id).notNull(),
  skillId: varchar('skill_id', { length: 100 }).notNull(),
  skillName: varchar('skill_name', { length: 255 }).notNull(),
  currentLevel: integer('current_level').default(0),
  branch: varchar('branch', { length: 50 }).notNull(),
  usageCount: integer('usage_count').default(0),
  successRate: integer('success_rate').default(100), // percentage
  lastUsedAt: timestamp('last_used_at'),
  unlockedAt: timestamp('unlocked_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const ailockXpHistory = pgTable('ailock_xp_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  ailockId: uuid('ailock_id').references(() => ailocks.id).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  xpGained: integer('xp_gained').notNull(),
  context: jsonb('context'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow()
});

export const ailockAchievements = pgTable('ailock_achievements', {
  id: uuid('id').defaultRandom().primaryKey(),
  ailockId: uuid('ailock_id').references(() => ailocks.id).notNull(),
  achievementId: varchar('achievement_id', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  icon: varchar('icon', { length: 500 }),
  rarity: varchar('rarity', { length: 20 }).default('common'),
  unlockedAt: timestamp('unlocked_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow()
});

export const chatSummaries = pgTable('chat_summaries', {
  userId: uuid('user_id').references(() => users.id).primaryKey(),
  summary: text('summary'),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const ailockInteractions = pgTable('ailock_interactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  fromAilockId: uuid('from_ailock_id').references(() => ailocks.id).notNull(),
  toAilockId: uuid('to_ailock_id').references(() => ailocks.id).notNull(),
  
  // Integration with existing systems
  sessionId: varchar('session_id', { length: 255 }), // references chat_sessions.blob_key
  intentId: uuid('intent_id').references(() => intents.id),
  
  // Core message data
  interactionType: varchar('interaction_type', { length: 30 }).notNull(),
  messageContent: text('message_content').notNull(),
  
  // LLM analysis results
  classification: jsonb('classification'),
  moderation: jsonb('moderation'),
  
  // Status management
  status: varchar('status', { length: 20 }).default('sent'),
  
  // Relationships and metadata
  parentInteractionId: uuid('parent_interaction_id'),
  chainId: uuid('chain_id'),
  priority: integer('priority').default(50),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  readAt: timestamp('read_at'),
  respondedAt: timestamp('responded_at')
});

export const taskDefinitions = pgTable('task_definitions', {
  id: varchar('id', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  eventTypeTrigger: varchar('event_type_trigger', { length: 100 }).notNull(),
  triggerCountGoal: integer('trigger_count_goal').default(1).notNull(),
  xpReward: integer('xp_reward').notNull(),
  category: varchar('category', { length: 50 }).default('daily'),
  unlockLevelRequirement: integer('unlock_level_requirement').default(1),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userTasks = pgTable('user_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: varchar('task_id', { length: 100 }).notNull().references(() => taskDefinitions.id),
  assignedDate: date('assigned_date').notNull(),
  progressCount: integer('progress_count').default(0),
  status: varchar('status', { length: 20 }).default('in_progress'), // 'in_progress', 'completed', 'claimed'
  completedAt: timestamp('completed_at'),
  claimedAt: timestamp('claimed_at'),
}, (table) => {
  return {
    uniqueUserTaskDate: unique('user_tasks_user_id_task_id_assigned_date_unique').on(table.userId, table.taskId, table.assignedDate),
    userStatusIdx: index('idx_user_tasks_user_status').on(table.userId, table.status),
    userDateIdx: index('idx_user_tasks_user_date').on(table.userId, table.assignedDate),
  };
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'message', 'invite', 'intent'
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  groupId: uuid('group_id').references(() => users.id, { onDelete: 'set null' }),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    userIdx: index('idx_notifications_user_id').on(table.userId),
    groupIdx: index('idx_notifications_group_id').on(table.groupId),
    readIdx: index('idx_notifications_read').on(table.read),
    typeIdx: index('idx_notifications_type').on(table.type),
    createdAtIdx: index('idx_notifications_created_at').on(table.createdAt),
  };
});

// RELATIONS

export const usersRelations = relations(users, ({ one, many }) => ({
	ailock: one(ailocks, {
    fields: [users.id],
    references: [ailocks.userId],
  }),
	chatSessions: many(chatSessions),
	intents: many(intents),
  userInWorkIntents: many(userInWorkIntents),
  offers: many(offers),
  steps: many(chainSteps),
  chatSummary: one(chatSummaries, {
    fields: [users.id],
    references: [chatSummaries.userId]
  }),
  userTasks: many(userTasks),
}));

export const ailocksRelations = relations(ailocks, ({ one, many }) => ({
  user: one(users, {
    fields: [ailocks.userId],
    references: [users.id],
  }),
  skills: many(ailockSkills),
  xpHistory: many(ailockXpHistory),
  achievements: many(ailockAchievements),
  sentInteractions: many(ailockInteractions, { relationName: 'fromAilock'}),
  receivedInteractions: many(ailockInteractions, { relationName: 'toAilock'}),
}));

export const ailockSkillsRelations = relations(ailockSkills, ({ one }) => ({
  ailock: one(ailocks, {
    fields: [ailockSkills.ailockId],
    references: [ailocks.id],
  }),
}));

export const ailockXpHistoryRelations = relations(ailockXpHistory, ({ one }) => ({
  ailock: one(ailocks, {
    fields: [ailockXpHistory.ailockId],
    references: [ailocks.id],
  }),
}));

export const ailockAchievementsRelations = relations(ailockAchievements, ({ one }) => ({
  ailock: one(ailocks, {
    fields: [ailockAchievements.ailockId],
    references: [ailocks.id],
  }),
}));

export const intentsRelations = relations(intents, ({ one, many }) => ({
  user: one(users, {
    fields: [intents.userId],
    references: [users.id],
  }),
  smartChain: one(smartChains, {
    fields: [intents.id],
    references: [smartChains.rootIntentId]
  }),
  userInWorkIntents: many(userInWorkIntents),
}));

export const userInWorkIntentsRelations = relations(userInWorkIntents, ({ one }) => ({
  user: one(users, {
    fields: [userInWorkIntents.userId],
    references: [users.id],
  }),
  intent: one(intents, {
    fields: [userInWorkIntents.intentId],
    references: [intents.id],
  }),
}));

export const ailockInteractionsRelations = relations(ailockInteractions, ({ one }) => ({
  fromAilock: one(ailocks, {
    fields: [ailockInteractions.fromAilockId],
    references: [ailocks.id],
    relationName: 'fromAilock'
  }),
  toAilock: one(ailocks, {
    fields: [ailockInteractions.toAilockId],
    references: [ailocks.id],
    relationName: 'toAilock'
  }),
}));

export const taskDefinitionsRelations = relations(taskDefinitions, ({ many }) => ({
  userTasks: many(userTasks),
}));

export const userTasksRelations = relations(userTasks, ({ one }) => ({
  user: one(users, {
    fields: [userTasks.userId],
    references: [users.id],
  }),
  taskDefinition: one(taskDefinitions, {
    fields: [userTasks.taskId],
    references: [taskDefinitions.id],
  }),
}));