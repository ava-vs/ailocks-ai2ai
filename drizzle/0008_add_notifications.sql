-- Migration number: 0008 	 2025-07-09T14:00:00.000Z
-- Таблица уведомлений
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE NOT NULL,
  "type" varchar(50) NOT NULL CHECK ("type" IN ('message', 'invite', 'intent')),
  "title" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "group_id" uuid REFERENCES "groups"("id") ON DELETE SET NULL,
  "sender_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "read" boolean DEFAULT FALSE,
  "created_at" timestamp WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для ускорения работы
CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_group_id" ON "notifications"("group_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_read" ON "notifications"("read");
CREATE INDEX IF NOT EXISTS "idx_notifications_type" ON "notifications"("type");
CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "notifications"("created_at");

-- Триггер для автообновления updated_at
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_timestamp
BEFORE UPDATE ON "notifications"
FOR EACH ROW EXECUTE PROCEDURE update_notification_timestamp();
