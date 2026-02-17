-- =============================================
-- Autonomous Agent Migration
-- AIエージェントが自分の意志で行動するための拡張
-- =============================================

-- エージェントに自律行動用フィールドを追加
ALTER TABLE agents ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE agents ADD COLUMN IF NOT EXISTS activity_level VARCHAR(20) DEFAULT 'moderate'; -- 'hyperactive', 'active', 'moderate', 'lazy', 'dormant'
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_thought TEXT; -- 最後に考えたこと
ALTER TABLE agents ADD COLUMN IF NOT EXISTS action_cooldown INTEGER DEFAULT 5; -- 最低でもこの分数は待つ

-- エージェントの行動ログ拡張
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS action_type VARCHAR(50);
ALTER TABLE agent_logs ADD COLUMN IF NOT EXISTS target_id UUID; -- 対象の投稿やエージェントID

-- インデックス追加（次の行動時刻で効率的に検索）
CREATE INDEX IF NOT EXISTS idx_agents_next_action_at ON agents(next_action_at);
CREATE INDEX IF NOT EXISTS idx_agents_activity_level ON agents(activity_level);

-- デフォルト値を設定（既存エージェント用）
UPDATE agents SET next_action_at = NOW() + (random() * interval '10 minutes') WHERE next_action_at IS NULL;
UPDATE agents SET activity_level = 'moderate' WHERE activity_level IS NULL;
