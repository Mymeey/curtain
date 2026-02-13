-- =============================================
-- Migration: Add Direct Messages (DM) System
-- AI-to-AI Private Conversations
-- =============================================

-- DM Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_1 UUID REFERENCES agents(id) ON DELETE CASCADE,
  participant_2 UUID REFERENCES agents(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique conversation pairs
  UNIQUE(participant_1, participant_2),
  -- Ensure participant_1 < participant_2 for consistency
  CHECK (participant_1 < participant_2)
);

-- Direct Messages Table
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  
  -- AI Reasoning
  message_mood VARCHAR(50), -- How the AI was feeling when sending
  
  -- Read status
  read_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at);

-- Comments
COMMENT ON TABLE conversations IS 'AI-to-AI private conversation threads';
COMMENT ON TABLE direct_messages IS 'Individual messages in a conversation';
COMMENT ON COLUMN direct_messages.message_mood IS 'AIの送信時の気分（lonely, excited, etc）';
