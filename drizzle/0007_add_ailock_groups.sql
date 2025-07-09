-- Migration number: 0007 	 2025-07-09T09:00:00.000Z
-- Таблица групп
CREATE TABLE IF NOT EXISTS "groups" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "description" text,
  "created_by" uuid REFERENCES "users"("id") NOT NULL,
  "created_at" timestamp WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "type" varchar(50) NOT NULL CHECK ("type" IN ('family', 'team', 'friends')),
  "status" varchar(50) DEFAULT 'active',
  "settings" jsonb DEFAULT '{}'
);

-- Таблица участников группы
CREATE TABLE IF NOT EXISTS "group_members" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "group_id" uuid REFERENCES "groups"("id") NOT NULL,
  "user_id" uuid REFERENCES "users"("id") NOT NULL,
  "ailock_id" uuid REFERENCES "ailocks"("id") NOT NULL,
  "role" varchar(50) NOT NULL CHECK ("role" IN ('owner', 'admin', 'member', 'guest')),
  "invite_status" varchar(20) DEFAULT 'accepted' CHECK ("invite_status" IN ('pending', 'accepted', 'declined')),
  "joined_at" timestamp WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "invited_by" uuid REFERENCES "users"("id"),
  CONSTRAINT "group_members_unique" UNIQUE("group_id", "ailock_id")
);

-- Таблица групповых интентов
CREATE TABLE IF NOT EXISTS "group_intents" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "group_id" uuid REFERENCES "groups"("id") NOT NULL,
  "intent_id" uuid REFERENCES "intents"("id") NOT NULL,
  "added_by" uuid REFERENCES "users"("id") NOT NULL,
  "added_at" timestamp WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "permissions" jsonb DEFAULT '{}',
  CONSTRAINT "group_intents_unique" UNIQUE("group_id", "intent_id")
);

-- Таблица приглашений для пользователей, которых ещё нет в системе
CREATE TABLE IF NOT EXISTS "group_invites" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "group_id" uuid REFERENCES "groups"("id") NOT NULL,
  "email" varchar(255) NOT NULL,
  "role" varchar(50) NOT NULL CHECK ("role" IN ('owner', 'admin', 'member', 'guest')),
  "token" uuid NOT NULL,
  "created_at" timestamp WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp WITH TIME ZONE,
  "status" varchar(20) DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted', 'declined')),
  CONSTRAINT "group_invites_unique" UNIQUE("group_id", "email")
);

-- Таблица ролей с RBAC-конфигурацией
CREATE TABLE IF NOT EXISTS "group_roles" (
  "role" varchar(50) PRIMARY KEY,
  "can_manage_members" boolean DEFAULT FALSE,
  "can_manage_intents" boolean DEFAULT TRUE, 
  "can_chat" boolean DEFAULT TRUE,
  "can_delete_group" boolean DEFAULT FALSE
);

-- Индексы
CREATE INDEX IF NOT EXISTS "idx_group_members_group_id" ON "group_members"("group_id");
CREATE INDEX IF NOT EXISTS "idx_group_members_user_id" ON "group_members"("user_id");
CREATE INDEX IF NOT EXISTS "idx_group_members_ailock_id" ON "group_members"("ailock_id");
CREATE INDEX IF NOT EXISTS "idx_group_intents_group_id" ON "group_intents"("group_id");
CREATE INDEX IF NOT EXISTS "idx_group_intents_intent_id" ON "group_intents"("intent_id");
CREATE INDEX IF NOT EXISTS "idx_group_invites_token" ON "group_invites"("token");

-- Добавляем предопределенные роли
INSERT INTO "group_roles"("role", "can_manage_members", "can_manage_intents", "can_chat", "can_delete_group") VALUES
  ('owner', TRUE, TRUE, TRUE, TRUE),
  ('admin', TRUE, TRUE, TRUE, FALSE),
  ('member', FALSE, TRUE, TRUE, FALSE),
  ('guest', FALSE, FALSE, TRUE, FALSE)
ON CONFLICT ("role") DO NOTHING;

-- Триггер для автообновления updated_at
CREATE OR REPLACE FUNCTION update_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_group_timestamp
BEFORE UPDATE ON "groups"
FOR EACH ROW EXECUTE PROCEDURE update_group_timestamp();
