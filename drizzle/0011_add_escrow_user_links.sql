-- English comment: migration for escrow_user_links table
CREATE TABLE IF NOT EXISTS "escrow_user_links" (
  "ai2ai_user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "escrow_user_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now()
);

-- Optional index for faster joins on escrow_user_id
CREATE INDEX IF NOT EXISTS idx_escrow_user_links_escrow_user_id ON "escrow_user_links"("escrow_user_id");
