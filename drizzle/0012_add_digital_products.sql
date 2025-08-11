-- Digital Distribution Tables Migration
-- Add support for chunked upload/download of digital products

-- Create enums for digital distribution
DO $$ BEGIN
 CREATE TYPE "public"."transfer_status_enum" AS ENUM('offered', 'invoiced', 'paid', 'delivered', 'acknowledged', 'disputed', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."payment_status_enum" AS ENUM('pending', 'paid', 'failed', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."scan_status_enum" AS ENUM('pending', 'clean', 'infected', 'quarantined');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."moderation_status_enum" AS ENUM('pending', 'approved', 'rejected', 'flagged');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Digital Products table
CREATE TABLE IF NOT EXISTS "digital_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_ailock_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"encryption_algo" varchar(50) DEFAULT 'AES-256-GCM',
	"content_hash" varchar(128) NOT NULL,
	"storage_type" varchar(50) DEFAULT 'netlify_blobs',
	"storage_pointer" varchar(255) NOT NULL,
	"manifest" jsonb,
	"created_at" timestamp DEFAULT now()
);

-- Product Transfers table
CREATE TABLE IF NOT EXISTS "product_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"from_ailock_id" uuid NOT NULL,
	"to_ailock_id" uuid NOT NULL,
	"price" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"status" "transfer_status_enum" DEFAULT 'offered',
	"policy" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Payment Intents table
CREATE TABLE IF NOT EXISTS "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) DEFAULT 'stripe',
	"provider_ref" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"status" "payment_status_enum" DEFAULT 'pending',
	"transfer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Product Keys table
CREATE TABLE IF NOT EXISTS "product_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"recipient_ailock_id" uuid NOT NULL,
	"key_envelope" text NOT NULL,
	"algo" varchar(50) DEFAULT 'X25519-AES-256-GCM',
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);

-- Delivery Receipts table
CREATE TABLE IF NOT EXISTS "delivery_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"client_hash" varchar(128) NOT NULL,
	"signature" text NOT NULL,
	"delivered_at" timestamp DEFAULT now(),
	"meta" jsonb DEFAULT '{}'
);

-- Content Checks table
CREATE TABLE IF NOT EXISTS "content_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"malware_scan" "scan_status_enum" DEFAULT 'pending',
	"moderation" "moderation_status_enum" DEFAULT 'pending',
	"reports" jsonb DEFAULT '{}',
	"checked_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "digital_products" ADD CONSTRAINT "digital_products_owner_ailock_id_ailocks_id_fk" FOREIGN KEY ("owner_ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_product_id_digital_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_from_ailock_id_ailocks_id_fk" FOREIGN KEY ("from_ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_transfers" ADD CONSTRAINT "product_transfers_to_ailock_id_ailocks_id_fk" FOREIGN KEY ("to_ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_transfer_id_product_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."product_transfers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_keys" ADD CONSTRAINT "product_keys_product_id_digital_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_keys" ADD CONSTRAINT "product_keys_recipient_ailock_id_ailocks_id_fk" FOREIGN KEY ("recipient_ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_transfer_id_product_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."product_transfers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "content_checks" ADD CONSTRAINT "content_checks_product_id_digital_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_digital_products_owner" ON "digital_products" ("owner_ailock_id");
CREATE INDEX IF NOT EXISTS "idx_digital_products_hash" ON "digital_products" ("content_hash");
CREATE INDEX IF NOT EXISTS "idx_product_transfers_product" ON "product_transfers" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_product_transfers_from" ON "product_transfers" ("from_ailock_id");
CREATE INDEX IF NOT EXISTS "idx_product_transfers_to" ON "product_transfers" ("to_ailock_id");
CREATE INDEX IF NOT EXISTS "idx_product_transfers_status" ON "product_transfers" ("status");
CREATE INDEX IF NOT EXISTS "idx_payment_intents_transfer" ON "payment_intents" ("transfer_id");
CREATE INDEX IF NOT EXISTS "idx_payment_intents_provider_ref" ON "payment_intents" ("provider_ref");
CREATE INDEX IF NOT EXISTS "idx_product_keys_product_recipient" ON "product_keys" ("product_id","recipient_ailock_id");
CREATE INDEX IF NOT EXISTS "idx_product_keys_expires" ON "product_keys" ("expires_at");
CREATE INDEX IF NOT EXISTS "idx_delivery_receipts_transfer" ON "delivery_receipts" ("transfer_id");
CREATE INDEX IF NOT EXISTS "idx_content_checks_product" ON "content_checks" ("product_id");
