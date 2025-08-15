-- Add Buyer Inputs Support for Digital Distribution
-- Adds required_inputs to digital_products and buyer_inputs to product_transfers

-- Add required_inputs column to digital_products table
-- This stores the schema for required buyer data collection
ALTER TABLE "digital_products" 
ADD COLUMN IF NOT EXISTS "required_inputs" jsonb DEFAULT '[]';

-- Add buyer_inputs column to product_transfers table  
-- This stores the actual collected buyer data
ALTER TABLE "product_transfers"
ADD COLUMN IF NOT EXISTS "buyer_inputs" jsonb DEFAULT '{}';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_digital_products_required_inputs" ON "digital_products" USING gin ("required_inputs");
CREATE INDEX IF NOT EXISTS "idx_product_transfers_buyer_inputs" ON "product_transfers" USING gin ("buyer_inputs");

-- Add comments for documentation
COMMENT ON COLUMN "digital_products"."required_inputs" IS 'Array of required input field definitions: [{ name, type, timing, required, description }]';
COMMENT ON COLUMN "product_transfers"."buyer_inputs" IS 'Collected buyer data: { field_name: value_or_attachment_ref }';
