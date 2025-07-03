CREATE TABLE "chain_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" uuid,
	"step_number" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending',
	"assigned_user_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"blob_key" varchar(255),
	"mode" varchar(50),
	"language" varchar(10),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chat_sessions_blob_key_unique" UNIQUE("blob_key")
);
--> statement-breakpoint
CREATE TABLE "intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"target_country" varchar(2),
	"target_city" varchar(255),
	"required_skills" text[],
	"budget" integer,
	"timeline" varchar(255),
	"priority" varchar(20) DEFAULT 'normal',
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "smart_chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"root_intent_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'planning',
	"total_steps" integer DEFAULT 0,
	"completed_steps" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"country" varchar(2),
	"city" varchar(255),
	"timezone" varchar(50),
	"languages" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chain_steps" ADD CONSTRAINT "chain_steps_chain_id_smart_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."smart_chains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chain_steps" ADD CONSTRAINT "chain_steps_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intents" ADD CONSTRAINT "intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_chains" ADD CONSTRAINT "smart_chains_root_intent_id_intents_id_fk" FOREIGN KEY ("root_intent_id") REFERENCES "public"."intents"("id") ON DELETE no action ON UPDATE no action;