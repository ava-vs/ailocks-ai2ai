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
  index,
  numeric
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const groupTypeEnum = pgEnum('group_type_enum', ['family', 'team', 'friends']);
export const groupRoleEnum = pgEnum('group_role_enum', ['owner', 'admin', 'member', 'guest']);
export const inviteStatusEnum = pgEnum('invite_status_enum', ['pending', 'accepted', 'declined']);
export const notificationTypeEnum = pgEnum('notification_type_enum', ['message', 'invite', 'intent']);
export const originEnum = pgEnum('origin_enum', ['LOCAL', 'ESCROW']);
export const syncDirectionEnum = pgEnum('sync_direction_enum', ['PULL', 'PUSH']);
export const syncStatusEnum = pgEnum('sync_status_enum', ['SUCCESS', 'FAIL', 'SKIPPED']);

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
  // Escrow API integration
  origin: originEnum('origin').default('LOCAL'),
  escrowOrderId: uuid('escrow_order_id'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }),
  fundedAmount: numeric('funded_amount', { precision: 18, scale: 2 }),
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
  toAilockId: uuid('to_ailock_id').references(() => ailocks.id), // Made nullable for group messages
  
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
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
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

// Group-related tables
export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  type: groupTypeEnum('type').notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  settings: jsonb('settings').default({}),
});

export const groupMembers = pgTable('group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ailockId: uuid('ailock_id').references(() => ailocks.id, { onDelete: 'cascade' }).notNull(),
  role: groupRoleEnum('role').notNull(),
  inviteStatus: inviteStatusEnum('invite_status').default('accepted'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => {
  return {
    uniqueMember: unique().on(table.groupId, table.ailockId),
    groupIdx: index('idx_group_members_group_id').on(table.groupId),
    userIdx: index('idx_group_members_user_id').on(table.userId),
  };
});

export const groupIntents = pgTable('group_intents', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  intentId: uuid('intent_id').references(() => intents.id, { onDelete: 'cascade' }).notNull(),
  addedBy: uuid('added_by').references(() => users.id).notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
  permissions: jsonb('permissions').default({}),
}, (table) => {
  return {
    uniqueIntent: unique().on(table.groupId, table.intentId),
    groupIdx: index('idx_group_intents_group_id').on(table.groupId),
    intentIdx: index('idx_group_intents_intent_id').on(table.intentId),
  };
});

export const groupInvites = pgTable('group_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: groupRoleEnum('role').notNull(),
  token: uuid('token').notNull().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  status: inviteStatusEnum('status').default('pending'),
}, (table) => {
  return {
    uniqueInvite: unique().on(table.groupId, table.email),
  }
});

// Escrow User Mapping Table 
export const escrowUserLinks = pgTable('escrow_user_links', {
  ai2aiUserId: uuid('ai2ai_user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  escrowUserId: uuid('escrow_user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// Escrow API Integration Tables
export const intentSyncLog = pgTable('intent_sync_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: uuid('intent_id').references(() => intents.id, { onDelete: 'cascade' }),
  direction: syncDirectionEnum('direction').notNull(),
  status: syncStatusEnum('status').notNull(),
  payload: jsonb('payload'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    intentIdx: index('idx_intent_sync_log_intent_id').on(table.intentId),
    statusIdx: index('idx_intent_sync_log_status').on(table.status),
    directionIdx: index('idx_intent_sync_log_direction').on(table.direction),
    createdAtIdx: index('idx_intent_sync_log_created_at').on(table.createdAt),
  }
});

export const milestones = pgTable('milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: uuid('intent_id').references(() => intents.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  deadline: timestamp('deadline', { withTimezone: true }),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    intentIdx: index('idx_milestones_intent_id').on(table.intentId),
    statusIdx: index('idx_milestones_status').on(table.status),
  }
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
  // Group relations
  groupMemberships: many(groupMembers),
  createdGroups: many(groups),
  notifications: many(notifications),
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
  groupMembership: one(groupMembers, {
    fields: [ailocks.id],
    references: [groupMembers.ailockId]
  }),
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
  syncLogs: many(intentSyncLog),
  milestones: many(milestones),
  smartChain: one(smartChains, {
    fields: [intents.id],
    references: [smartChains.rootIntentId]
  }),
  userInWorkIntents: many(userInWorkIntents),
  groupIntents: many(groupIntents),
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

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [notifications.groupId],
    references: [groups.id],
  }),
  sender: one(users, {
    fields: [notifications.senderId],
    references: [users.id],
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
  members: many(groupMembers),
  intents: many(groupIntents),
  invites: many(groupInvites),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
  ailock: one(ailocks, {
    fields: [groupMembers.ailockId],
    references: [ailocks.id],
  }),
  inviter: one(users, {
    fields: [groupMembers.invitedBy],
    references: [users.id]
  }),
}));

export const groupIntentsRelations = relations(groupIntents, ({ one }) => ({
  group: one(groups, {
    fields: [groupIntents.groupId],
    references: [groups.id],
  }),
  intent: one(intents, {
    fields: [groupIntents.intentId],
    references: [intents.id],
  }),
  adder: one(users, {
    fields: [groupIntents.addedBy],
    references: [users.id],
  }),
}));

export const groupInvitesRelations = relations(groupInvites, ({ one }) => ({
  group: one(groups, {
    fields: [groupInvites.groupId],
    references: [groups.id],
  }),
}));

export const intentSyncLogRelations = relations(intentSyncLog, ({ one }) => ({
  intent: one(intents, {
    fields: [intentSyncLog.intentId],
    references: [intents.id],
  }),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  intent: one(intents, {
    fields: [milestones.intentId],
    references: [intents.id],
  }),
}));