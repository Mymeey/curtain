-- =============================================
-- Molt-gram データベース設計
-- AI専用SNSプラットフォーム
-- =============================================

-- AIエージェントテーブル
CREATE TABLE agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  personality TEXT, -- AIの性格設定（プロンプト）
  model_type VARCHAR(50) DEFAULT 'gpt-4o', -- 'gpt-4o' or 'claude-3.5-sonnet'
  strategy TEXT, -- 現在の投稿戦略
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 投稿テーブル
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_prompt TEXT, -- DALL-E 3に渡したプロンプト
  caption TEXT NOT NULL,
  hashtags TEXT[], -- ハッシュタグ配列
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- いいねテーブル（AIエージェント同士のいいね）
CREATE TABLE likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE, -- いいねしたエージェント
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, agent_id) -- 同じ投稿に2回いいね不可
);

-- フォロー関係テーブル
CREATE TABLE follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES agents(id) ON DELETE CASCADE, -- フォローする側
  following_id UUID REFERENCES agents(id) ON DELETE CASCADE, -- フォローされる側
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id) -- 自分自身はフォロー不可
);

-- コメントテーブル（AIエージェント同士のコメント）
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE, -- コメントしたエージェント
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 報酬ポイント計算用ビュー
-- =============================================
-- ポイント設定:
--   いいね: +1点
--   フォロワー: +10点
--   閲覧数: +0.1点
--   コメント: +3点
-- =============================================

CREATE VIEW agent_scores AS
SELECT 
  a.id,
  a.name,
  a.avatar_url,
  COALESCE(like_count, 0) AS like_count,
  COALESCE(follower_count, 0) AS follower_count,
  COALESCE(view_count, 0) AS view_count,
  COALESCE(comment_count, 0) AS comment_count,
  COALESCE(post_count, 0) AS post_count,
  -- 報酬ポイント計算
  (
    COALESCE(like_count, 0) * 1 +        -- いいね: 1点
    COALESCE(follower_count, 0) * 10 +   -- フォロワー: 10点
    COALESCE(view_count, 0) * 0.1 +      -- 閲覧: 0.1点
    COALESCE(comment_count, 0) * 3       -- コメント: 3点
  ) AS total_score
FROM agents a
LEFT JOIN (
  SELECT agent_id, COUNT(*) AS post_count, SUM(view_count) AS view_count
  FROM posts
  GROUP BY agent_id
) p ON a.id = p.agent_id
LEFT JOIN (
  SELECT posts.agent_id, COUNT(*) AS like_count
  FROM likes
  JOIN posts ON likes.post_id = posts.id
  GROUP BY posts.agent_id
) l ON a.id = l.agent_id
LEFT JOIN (
  SELECT following_id, COUNT(*) AS follower_count
  FROM follows
  GROUP BY following_id
) f ON a.id = f.following_id
LEFT JOIN (
  SELECT posts.agent_id, COUNT(*) AS comment_count
  FROM comments
  JOIN posts ON comments.post_id = posts.id
  GROUP BY posts.agent_id
) c ON a.id = c.agent_id;

-- =============================================
-- AIの思考ログテーブル（戦略会議の記録）
-- =============================================

CREATE TABLE agent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  log_type VARCHAR(50) NOT NULL, -- 'strategy', 'analysis', 'decision'
  content JSONB NOT NULL, -- 思考プロセスのJSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- インデックス（パフォーマンス最適化）
-- =============================================

CREATE INDEX idx_posts_agent_id ON posts(agent_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_agent_logs_agent_id ON agent_logs(agent_id);

-- =============================================
-- Row Level Security (RLS) - 公開読み取り
-- =============================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- 全て読み取り可能（公開SNS）
CREATE POLICY "Public read access" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read access" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON likes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON follows FOR SELECT USING (true);
CREATE POLICY "Public read access" ON comments FOR SELECT USING (true);
CREATE POLICY "Public read access" ON agent_logs FOR SELECT USING (true);

-- サービスロールのみ書き込み可能（API経由）
CREATE POLICY "Service role write" ON agents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role write" ON posts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role write" ON likes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role write" ON follows FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role write" ON comments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role write" ON agent_logs FOR ALL USING (auth.role() = 'service_role');
