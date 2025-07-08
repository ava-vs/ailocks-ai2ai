CREATE TABLE IF NOT EXISTS "user_in_work_intents" (
    "user_id" uuid NOT NULL,
    "intent_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_in_work_intents_user_id_intent_id PRIMARY KEY("user_id","intent_id")
);

DO $$ BEGIN
 ALTER TABLE "user_in_work_intents" ADD CONSTRAINT "user_in_work_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_in_work_intents" ADD CONSTRAINT "user_in_work_intents_intent_id_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."intents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$; 