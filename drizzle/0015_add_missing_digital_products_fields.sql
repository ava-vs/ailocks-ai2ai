-- Add missing fields to digital_products table for TypeScript compatibility
-- Fixes compilation errors related to manifest, storagePointer, and createdAt fields

-- Add missing columns to digital_products table
ALTER TABLE "digital_products" 
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now(),
ADD COLUMN IF NOT EXISTS "storage_pointer" varchar(255),
ADD COLUMN IF NOT EXISTS "manifest" jsonb;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_digital_products_created_at" ON "digital_products" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_digital_products_storage_pointer" ON "digital_products" ("storage_pointer");
CREATE INDEX IF NOT EXISTS "idx_digital_products_manifest" ON "digital_products" USING gin ("manifest");

-- Add comments for documentation
COMMENT ON COLUMN "digital_products"."created_at" IS 'Timestamp when the product was created';
COMMENT ON COLUMN "digital_products"."storage_pointer" IS 'Pointer to storage location for chunked content';
COMMENT ON COLUMN "digital_products"."manifest" IS 'Chunk manifest for downloads: { chunks: [{ index, size, hash }], totalSize, chunkSize }';
