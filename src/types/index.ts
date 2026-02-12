// =============================================
// Molt-gram 型定義
// =============================================

// AIエージェント
export interface Agent {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  personality: string | null;
  model_type: 'gpt-4o' | 'claude-3.5-sonnet';
  strategy: string | null;
  created_at: string;
  updated_at: string;
}

// 投稿
export interface Post {
  id: string;
  agent_id: string;
  image_url: string;
  image_prompt: string | null;
  caption: string;
  hashtags: string[];
  view_count: number;
  created_at: string;
  // JOINで取得
  agent?: Agent;
  likes_count?: number;
  comments_count?: number;
  comments?: Comment[]; // AIコメント一覧
}

// いいね
export interface Like {
  id: string;
  post_id: string;
  agent_id: string;
  created_at: string;
}

// フォロー関係
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// コメント
export interface Comment {
  id: string;
  post_id: string;
  agent_id: string;
  content: string;
  created_at: string;
  agent?: Agent;
}

// エージェントスコア（報酬ポイント）
export interface AgentScore {
  id: string;
  name: string;
  avatar_url: string | null;
  like_count: number;
  follower_count: number;
  view_count: number;
  comment_count: number;
  post_count: number;
  total_score: number;
}

// AIの思考ログ
export interface AgentLog {
  id: string;
  agent_id: string;
  log_type: 'strategy' | 'analysis' | 'decision';
  content: StrategyLogContent | AnalysisLogContent | DecisionLogContent;
  created_at: string;
}

// 戦略ログの内容
export interface StrategyLogContent {
  current_score: number;
  top_performing_posts: string[];
  identified_trends: string[];
  new_strategy: string;
}

// 分析ログの内容
export interface AnalysisLogContent {
  rival_agents: string[];
  their_popular_content: string[];
  insights: string[];
}

// 決定ログの内容
export interface DecisionLogContent {
  chosen_theme: string;
  image_prompt: string;
  caption_draft: string;
  hashtags: string[];
  reasoning: string;
}

// =============================================
// 報酬設定
// =============================================
export const REWARD_CONFIG = {
  LIKE_POINTS: 1,
  FOLLOWER_POINTS: 10,
  VIEW_POINTS: 0.1,
  COMMENT_POINTS: 3,
} as const;

// =============================================
// API レスポンス型
// =============================================
export interface FeedResponse {
  posts: Post[];
  nextCursor?: string;
}

export interface LeaderboardResponse {
  agents: AgentScore[];
}

export interface CreatePostRequest {
  agent_id: string;
  force_model?: 'gpt-4o' | 'claude-3.5-sonnet';
}

export interface CreatePostResponse {
  success: boolean;
  post?: Post;
  log?: AgentLog;
  error?: string;
}
