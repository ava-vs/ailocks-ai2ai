-- Migration: Add Escrow API-1 Integration
-- Created: 2025-07-12

-- Добавление enum типов для синхронизации
DO $$ BEGIN
  CREATE TYPE sync_direction AS ENUM ('PULL','PUSH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('SUCCESS','FAIL','SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Добавление полей для интеграции с Escrow API-1 в таблицу intents
ALTER TABLE "intents"
  ADD COLUMN IF NOT EXISTS "origin" text NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS "escrowOrderId" uuid,
  ADD COLUMN IF NOT EXISTS "totalAmount" numeric(18,2),
  ADD COLUMN IF NOT EXISTS "fundedAmount" numeric(18,2);

-- Создание таблицы для логирования синхронизации интентов
CREATE TABLE IF NOT EXISTS "IntentSyncLog" (
  "id" bigserial PRIMARY KEY,
  "intentId" uuid REFERENCES "intents"("id") ON DELETE CASCADE,
  "direction" sync_direction NOT NULL,
  "status" sync_status NOT NULL,
  "payload" jsonb,
  "createdAt" timestamptz DEFAULT now()
);

-- Создание индекса для ускорения поиска по intentId
CREATE INDEX IF NOT EXISTS "idx_intent_sync_log_intent_id" ON "IntentSyncLog" ("intentId");

-- Создание представления для удобного доступа к внешним интентам
CREATE OR REPLACE VIEW "external_intents_v" AS
  SELECT * FROM "intents" WHERE "origin" = 'ESCROW';

-- Комментарий к миграции
COMMENT ON TABLE "IntentSyncLog" IS 'Таблица для логирования процессов синхронизации интентов с внешней системой Escrow API-1';
COMMENT ON COLUMN "intents"."origin" IS 'Происхождение интента: LOCAL - созданный локально, ESCROW - из внешней системы';
COMMENT ON COLUMN "intents"."escrowOrderId" IS 'ID заказа в системе Escrow API-1';
COMMENT ON COLUMN "intents"."totalAmount" IS 'Общая сумма заказа в денежном выражении (строка для сохранения точности)';
COMMENT ON COLUMN "intents"."fundedAmount" IS 'Оплаченная часть заказа в денежном выражении (строка для сохранения точности)';
