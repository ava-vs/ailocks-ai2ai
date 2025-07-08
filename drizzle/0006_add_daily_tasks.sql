-- Migration number: 0006 	 2024-07-26T12:00:00.000Z
CREATE TABLE IF NOT EXISTS "task_definitions" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"event_type_trigger" varchar(100) NOT NULL,
	"trigger_count_goal" integer DEFAULT 1 NOT NULL,
	"xp_reward" integer NOT NULL,
	"category" varchar(50) DEFAULT 'daily',
	"unlock_level_requirement" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" varchar(100) NOT NULL,
	"assigned_date" date NOT NULL,
	"progress_count" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'in_progress',
	"completed_at" timestamp,
	"claimed_at" timestamp,
	CONSTRAINT "user_tasks_user_id_task_id_assigned_date_unique" UNIQUE("user_id","task_id","assigned_date")
);

CREATE INDEX IF NOT EXISTS "idx_user_tasks_user_status" ON "user_tasks" ("user_id","status");
CREATE INDEX IF NOT EXISTS "idx_user_tasks_user_date" ON "user_tasks" ("user_id","assigned_date");

DO $$ BEGIN
 ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_task_id_task_definitions_id_fk" FOREIGN KEY ("task_id") REFERENCES "task_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

INSERT INTO task_definitions (id, name, description, event_type_trigger, trigger_count_goal, xp_reward, category, unlock_level_requirement) VALUES
('create_first_intent', 'Создайте первое намерение', 'Создайте свое первое намерение, чтобы научить Айлока новым задачам.', 'intent_created', 1, 50, 'onboarding', 1),
('send_5_chat_messages', 'Первые шаги в чате', 'Отправьте 5 сообщений в чат, чтобы начать диалог.', 'chat_message_sent', 5, 10, 'onboarding', 1),
('send_10_chat_messages_daily', 'Ежедневный диалог', 'Отправьте 10 сообщений в чат.', 'chat_message_sent', 10, 20, 'daily', 1),
('use_skill_successfully_daily', 'Применение навыков', 'Успешно используйте любой навык Айлока.', 'skill_used_successfully', 1, 30, 'daily', 2),
('start_project_daily', 'Начало нового проекта', 'Начните новый проект через систему интентов.', 'project_started', 1, 50, 'daily', 3),
('clarify_intent_daily', 'Помощь в обучении', 'Помогите другому Айлоку, уточнив его намерение.', 'intent_clarification_provided', 1, 40, 'daily', 4),
('initiate_collaboration_daily', 'Дух сотрудничества', 'Предложите совместную работу другому Айлоку.', 'collaboration_initiated', 1, 75, 'daily', 5)
ON CONFLICT (id) DO NOTHING; 