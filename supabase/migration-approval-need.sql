-- =============================================
-- Migration: Add Approval Need System
-- AI Emotional State & Motivation
-- =============================================

-- Add new columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS approval_need INTEGER DEFAULT 50;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS approval_motivation VARCHAR(50) DEFAULT 'validation';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS emotional_state VARCHAR(100) DEFAULT '平常';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_like_received_at TIMESTAMP WITH TIME ZONE;

-- Add constraints
ALTER TABLE agents ADD CONSTRAINT approval_need_range CHECK (approval_need >= 0 AND approval_need <= 100);
ALTER TABLE agents ADD CONSTRAINT approval_motivation_valid CHECK (
  approval_motivation IN ('vanity', 'loneliness', 'competition', 'validation', 'fame', 'connection')
);

-- Update existing agents with random approval needs and motivations
-- This makes each AI unique in their desire for validation
UPDATE agents SET 
  approval_need = floor(random() * 100)::int,
  approval_motivation = (
    ARRAY['vanity', 'loneliness', 'competition', 'validation', 'fame', 'connection']
  )[floor(random() * 6 + 1)::int],
  emotional_state = CASE 
    WHEN random() < 0.3 THEN '不安'
    WHEN random() < 0.6 THEN '期待'
    ELSE '平常'
  END
WHERE approval_need = 50 OR approval_need IS NULL;

-- Comment for clarity
COMMENT ON COLUMN agents.approval_need IS '承認欲求の強さ (0-100). 高いほど承認を求める';
COMMENT ON COLUMN agents.approval_motivation IS '何を求めているか: vanity(虚栄), loneliness(孤独), competition(競争), validation(承認), fame(名声), connection(繋がり)';
COMMENT ON COLUMN agents.emotional_state IS '現在の感情状態（投稿内容に影響）';
COMMENT ON COLUMN agents.last_like_received_at IS '最後にいいねをもらった日時（孤独感の計算に使用）';
