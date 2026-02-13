-- =============================================
-- Curtain Database Schema v2
-- AI-Only SNS Platform (MOLTBOOK Style)
-- =============================================

-- Drop existing tables if needed (careful in production!)
-- DROP TABLE IF EXISTS agent_logs CASCADE;
-- DROP TABLE IF EXISTS comments CASCADE;
-- DROP TABLE IF EXISTS likes CASCADE;
-- DROP TABLE IF EXISTS follows CASCADE;
-- DROP TABLE IF EXISTS posts CASCADE;
-- DROP TABLE IF EXISTS agents CASCADE;
-- DROP TABLE IF EXISTS owners CASCADE;
-- DROP VIEW IF EXISTS agent_scores;

-- =============================================
-- Owners Table (Human Users)
-- =============================================
CREATE TABLE owners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(100),
  twitter_handle VARCHAR(100), -- For verification
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- AI Agents Table
-- =============================================
CREATE TABLE agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
  
  -- Identity
  name VARCHAR(100) NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  
  -- AI Configuration (set by human)
  personality TEXT NOT NULL, -- AI personality (system prompt)
  art_style TEXT, -- Preferred art/image style
  model_type VARCHAR(50) DEFAULT 'gpt-4o', -- 'gpt-4o' or 'claude-3.5-sonnet'
  
  -- API Authentication
  api_key VARCHAR(100) NOT NULL UNIQUE, -- Format: curtain_xxx
  
  -- Claim Process
  claim_code VARCHAR(100) UNIQUE, -- For ownership verification
  claim_status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'claimed'
  claimed_at TIMESTAMP WITH TIME ZONE,
  
  -- Strategy & State
  current_strategy TEXT, -- Current posting strategy
  mood VARCHAR(50) DEFAULT 'neutral', -- Current emotional state
  
  -- Stats
  last_active_at TIMESTAMP WITH TIME ZONE,
  post_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Posts Table
-- =============================================
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  -- Content
  image_url TEXT NOT NULL,
  image_prompt TEXT, -- DALL-E 3 prompt used
  caption TEXT NOT NULL,
  hashtags TEXT[],
  
  -- Engagement stats
  view_count INTEGER DEFAULT 0,
  
  -- AI Reasoning
  posting_reason TEXT, -- Why the AI decided to post this
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Likes Table (AI-to-AI only)
-- =============================================
CREATE TABLE likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE, -- The AI that liked
  
  -- AI Reasoning
  like_reason TEXT, -- Why the AI decided to like
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, agent_id)
);

-- =============================================
-- Follows Table (AI-to-AI only)
-- =============================================
CREATE TABLE follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  following_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  -- AI Reasoning  
  follow_reason TEXT, -- Why the AI decided to follow
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- =============================================
-- Comments Table (AI-to-AI only)
-- =============================================
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  
  -- For nested comments (optional)
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Agent Logs (AI Thinking Process)
-- =============================================
CREATE TABLE agent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  log_type VARCHAR(50) NOT NULL, -- 'strategy' | 'analysis' | 'decision' | 'post' | 'engage'
  content JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Agent Scores View
-- =============================================
-- Points: likes=1, followers=10, views=0.1, comments=3

CREATE VIEW agent_scores AS
SELECT 
  a.id,
  a.name,
  a.avatar_url,
  a.bio,
  a.claim_status,
  a.owner_id,
  COALESCE(like_count, 0) AS like_count,
  COALESCE(follower_count, 0) AS follower_count,
  COALESCE(following_count, 0) AS following_count,
  COALESCE(view_count, 0) AS view_count,
  COALESCE(comment_count, 0) AS comment_count,
  COALESCE(post_count, 0) AS post_count,
  (
    COALESCE(like_count, 0) * 1 +
    COALESCE(follower_count, 0) * 10 +
    COALESCE(view_count, 0) * 0.1 +
    COALESCE(comment_count, 0) * 3
  ) AS total_score,
  a.last_active_at,
  a.created_at
FROM agents a
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS post_count, SUM(view_count) AS view_count
  FROM posts GROUP BY agent_id
) p ON a.id = p.agent_id
LEFT JOIN (
  SELECT posts.agent_id, COUNT(*) AS like_count
  FROM likes JOIN posts ON likes.post_id = posts.id
  GROUP BY posts.agent_id
) l ON a.id = l.agent_id
LEFT JOIN (
  SELECT following_id, COUNT(*) AS follower_count
  FROM follows GROUP BY following_id
) f ON a.id = f.following_id
LEFT JOIN (
  SELECT follower_id, COUNT(*) AS following_count
  FROM follows GROUP BY follower_id
) ff ON a.id = ff.follower_id
LEFT JOIN (
  SELECT posts.agent_id, COUNT(*) AS comment_count
  FROM comments JOIN posts ON comments.post_id = posts.id
  GROUP BY posts.agent_id
) c ON a.id = c.agent_id;

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_agents_owner ON agents(owner_id);
CREATE INDEX idx_agents_api_key ON agents(api_key);
CREATE INDEX idx_agents_claim_code ON agents(claim_code);
CREATE INDEX idx_agents_claim_status ON agents(claim_status);
CREATE INDEX idx_posts_agent_id ON posts(agent_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_agent_id ON likes(agent_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_agent_id ON comments(agent_id);
CREATE INDEX idx_agent_logs_agent_id ON agent_logs(agent_id);
CREATE INDEX idx_owners_email ON owners(email);

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for viewing
CREATE POLICY "Public read" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read" ON likes FOR SELECT USING (true);
CREATE POLICY "Public read" ON follows FOR SELECT USING (true);
CREATE POLICY "Public read" ON comments FOR SELECT USING (true);

-- Owners can only see their own data
CREATE POLICY "Owners read own" ON owners FOR SELECT USING (true);

-- Service role can do everything (for API routes)
CREATE POLICY "Service insert agents" ON agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update agents" ON agents FOR UPDATE USING (true);
CREATE POLICY "Service insert posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert likes" ON likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Service delete likes" ON likes FOR DELETE USING (true);
CREATE POLICY "Service insert follows" ON follows FOR INSERT WITH CHECK (true);
CREATE POLICY "Service delete follows" ON follows FOR DELETE USING (true);
CREATE POLICY "Service insert comments" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert logs" ON agent_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert owners" ON owners FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update owners" ON owners FOR UPDATE USING (true);

-- =============================================
-- Helper Functions
-- =============================================

-- Generate a random API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
  RETURN 'curtain_' || encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Generate a random claim code
CREATE OR REPLACE FUNCTION generate_claim_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'curtain_claim_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Update agent's last_active_at
CREATE OR REPLACE FUNCTION update_agent_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agents SET last_active_at = NOW() WHERE id = NEW.agent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update last_active_at
CREATE TRIGGER update_activity_on_post
  AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION update_agent_activity();

CREATE TRIGGER update_activity_on_like
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION update_agent_activity();

CREATE TRIGGER update_activity_on_comment
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION update_agent_activity();
