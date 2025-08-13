-- Enhanced Digital Products Schema Migration
-- Adds missing fields for complete e-commerce functionality

-- Create additional enums
DO $$ BEGIN
 CREATE TYPE "public"."product_status_enum" AS ENUM('draft', 'published', 'archived', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."discount_type_enum" AS ENUM('percentage', 'fixed_amount', 'buy_x_get_y');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."license_type_enum" AS ENUM('single_use', 'multi_use', 'unlimited', 'subscription', 'enterprise');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to digital_products table
ALTER TABLE "digital_products" 
ADD COLUMN IF NOT EXISTS "description" text,
ADD COLUMN IF NOT EXISTS "short_description" varchar(500),
ADD COLUMN IF NOT EXISTS "price" numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS "status" "product_status_enum" DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS "category" varchar(100),
ADD COLUMN IF NOT EXISTS "tags" text[],
ADD COLUMN IF NOT EXISTS "license_type" "license_type_enum" DEFAULT 'single_use',
ADD COLUMN IF NOT EXISTS "license_terms" text,
ADD COLUMN IF NOT EXISTS "preview_content" text,
ADD COLUMN IF NOT EXISTS "thumbnail_url" varchar(500),
ADD COLUMN IF NOT EXISTS "demo_url" varchar(500),
ADD COLUMN IF NOT EXISTS "version" varchar(20) DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS "changelog" jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "requirements" jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "seo_title" varchar(255),
ADD COLUMN IF NOT EXISTS "seo_description" varchar(500),
ADD COLUMN IF NOT EXISTS "seo_keywords" text[],
ADD COLUMN IF NOT EXISTS "download_count" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "rating_average" numeric(3, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "rating_count" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "featured" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "published_at" timestamp,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

-- Create product discounts table
CREATE TABLE IF NOT EXISTS "product_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"discount_type" "discount_type_enum" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"min_quantity" integer DEFAULT 1,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0,
	"code" varchar(50) UNIQUE,
	"is_active" boolean DEFAULT true,
	"starts_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create product bundles table
CREATE TABLE IF NOT EXISTS "product_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"bundle_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"discount_percentage" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create bundle items table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS "bundle_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);

-- Create product reviews table
CREATE TABLE IF NOT EXISTS "product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"reviewer_ailock_id" uuid NOT NULL,
	"rating" integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
	"title" varchar(255),
	"comment" text,
	"is_verified_purchase" boolean DEFAULT false,
	"is_approved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create product analytics table
CREATE TABLE IF NOT EXISTS "product_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL, -- 'view', 'download', 'purchase', 'share'
	"user_ailock_id" uuid,
	"session_id" varchar(100),
	"ip_address" inet,
	"user_agent" text,
	"referrer" varchar(500),
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now()
);

-- Create product categories table
CREATE TABLE IF NOT EXISTS "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL UNIQUE,
	"slug" varchar(100) NOT NULL UNIQUE,
	"description" text,
	"parent_id" uuid,
	"icon" varchar(100),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "product_discounts" ADD CONSTRAINT "product_discounts_product_id_digital_products_id_fk" 
 FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_product_bundles_id_fk" 
 FOREIGN KEY ("bundle_id") REFERENCES "public"."product_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_product_id_digital_products_id_fk" 
 FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_digital_products_id_fk" 
 FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_reviewer_ailock_id_ailocks_id_fk" 
 FOREIGN KEY ("reviewer_ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_analytics" ADD CONSTRAINT "product_analytics_product_id_digital_products_id_fk" 
 FOREIGN KEY ("product_id") REFERENCES "public"."digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_analytics" ADD CONSTRAINT "product_analytics_user_ailock_id_ailocks_id_fk" 
 FOREIGN KEY ("user_ailock_id") REFERENCES "public"."ailocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_product_categories_id_fk" 
 FOREIGN KEY ("parent_id") REFERENCES "public"."product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_digital_products_status" ON "digital_products"("status");
CREATE INDEX IF NOT EXISTS "idx_digital_products_category" ON "digital_products"("category");
CREATE INDEX IF NOT EXISTS "idx_digital_products_price" ON "digital_products"("price");
CREATE INDEX IF NOT EXISTS "idx_digital_products_featured" ON "digital_products"("featured");
CREATE INDEX IF NOT EXISTS "idx_digital_products_published_at" ON "digital_products"("published_at");
CREATE INDEX IF NOT EXISTS "idx_product_discounts_code" ON "product_discounts"("code");
CREATE INDEX IF NOT EXISTS "idx_product_discounts_active" ON "product_discounts"("is_active");
CREATE INDEX IF NOT EXISTS "idx_product_reviews_rating" ON "product_reviews"("rating");
CREATE INDEX IF NOT EXISTS "idx_product_analytics_event_type" ON "product_analytics"("event_type");
CREATE INDEX IF NOT EXISTS "idx_product_analytics_created_at" ON "product_analytics"("created_at");

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_digital_products_updated_at BEFORE UPDATE ON digital_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_discounts_updated_at BEFORE UPDATE ON product_discounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_bundles_updated_at BEFORE UPDATE ON product_bundles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories
INSERT INTO "product_categories" ("name", "slug", "description", "sort_order") VALUES
('Solutions', 'solutions', 'Готовые решения и практики', 1),
('Templates', 'templates', 'Шаблоны и заготовки', 2),
('Guides', 'guides', 'Руководства и инструкции', 3),
('Tools', 'tools', 'Инструменты и утилиты', 4),
('Courses', 'courses', 'Обучающие курсы', 5)
ON CONFLICT (slug) DO NOTHING;
