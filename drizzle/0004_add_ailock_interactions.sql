-- Migration: Add ailock_interactions table for AI2AI communication
-- This integrates with existing chat_sessions, intents, and ailocks tables

CREATE TABLE ailock_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_ailock_id UUID REFERENCES ailocks(id) NOT NULL,
  to_ailock_id UUID REFERENCES ailocks(id) NOT NULL,
  
  -- Integration with existing systems
  session_id VARCHAR(255), -- references chat_sessions.blob_key
  intent_id UUID REFERENCES intents(id),
  
  -- Core message data
  interaction_type VARCHAR(30) NOT NULL CHECK (interaction_type IN (
    'clarify_intent', 'provide_info', 'collaboration_request', 'response'
  )),
  message_content TEXT NOT NULL,
  
  -- LLM analysis results
  classification JSONB, -- classification results from LLM
  moderation JSONB,     -- content moderation results
  
  -- Status management
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN (
    'sent', 'delivered', 'read', 'responded', 'archived'
  )),
  
  -- Relationships and metadata
  parent_interaction_id UUID REFERENCES ailock_interactions(id),
  chain_id UUID,       -- for Smart Chains integration
  priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  responded_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_ailock_interactions_to_ailock_status ON ailock_interactions(to_ailock_id, status);
CREATE INDEX idx_ailock_interactions_intent ON ailock_interactions(intent_id) WHERE intent_id IS NOT NULL;
CREATE INDEX idx_ailock_interactions_session ON ailock_interactions(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_ailock_interactions_created_at ON ailock_interactions(created_at);
CREATE INDEX idx_ailock_interactions_parent ON ailock_interactions(parent_interaction_id) WHERE parent_interaction_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE ailock_interactions IS 'AI2AI communication between Ailocks, integrated with existing chat and intent systems'; 