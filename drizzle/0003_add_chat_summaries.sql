-- Create chat_summaries table for storing per-user chat history summaries
CREATE TABLE IF NOT EXISTS chat_summaries (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  summary  TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
); 