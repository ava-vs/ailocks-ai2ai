CREATE TABLE "ailock_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ailock_id" uuid NOT NULL,
	"achievement_id" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(500),
	"rarity" varchar(20) DEFAULT 'common',
	"unlocked_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ailock_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ailock_id" uuid NOT NULL,
	"skill_id" varchar(100) NOT NULL,
	"skill_name" varchar(255) NOT NULL,
	"current_level" integer DEFAULT 0,
	"branch" varchar(50) NOT NULL,
	"usage_count" integer DEFAULT 0,
	"success_rate" integer DEFAULT 100,
	"last_used_at" timestamp,
	"unlocked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ailock_xp_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ailock_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"xp_gained" integer NOT NULL,
	"context" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ailocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) DEFAULT 'Ailock',
	"level" integer DEFAULT 1,
	"xp" integer DEFAULT 0,
	"skill_points" integer DEFAULT 0,
	"velocity" integer DEFAULT 10,
	"insight" integer DEFAULT 10,
	"efficiency" integer DEFAULT 10,
	"economy" integer DEFAULT 10,
	"convenience" integer DEFAULT 10,
	"avatar_preset" varchar(50) DEFAULT 'robot',
	"total_intents_created" integer DEFAULT 0,
	"total_chat_messages" integer DEFAULT 0,
	"total_skills_used" integer DEFAULT 0,
	"last_active_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ailocks_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"skills" text[],
	"price" integer,
	"currency" varchar(3) DEFAULT 'USD',
	"location_flexibility" varchar(20) DEFAULT 'flexible',
	"status" varchar(20) DEFAULT 'active',
	"embedding" vector(1536),
	"embedding_model" varchar(50) DEFAULT 'text-embedding-3-small',
	"embedding_generated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chain_steps" ADD COLUMN "estimated_hours" integer;--> statement-breakpoint
ALTER TABLE "chain_steps" ADD COLUMN "required_skills" text[];--> statement-breakpoint
ALTER TABLE "chain_steps" ADD COLUMN "deliverable" text;--> statement-breakpoint
ALTER TABLE "chain_steps" ADD COLUMN "dependencies" text[];--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "embedding_model" varchar(50) DEFAULT 'text-embedding-3-small';--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "embedding_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "ailock_achievements" ADD CONSTRAINT "ailock_achievements_ailock_id_ailocks_id_fk" FOREIGN KEY ("ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ailock_skills" ADD CONSTRAINT "ailock_skills_ailock_id_ailocks_id_fk" FOREIGN KEY ("ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ailock_xp_history" ADD CONSTRAINT "ailock_xp_history_ailock_id_ailocks_id_fk" FOREIGN KEY ("ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ailocks" ADD CONSTRAINT "ailocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;