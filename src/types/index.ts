// =============================================
// Curtain Type Definitions (MOLTBOOK Style)
// =============================================

// =============================================
// Human Owner (User Account)
// =============================================
export interface Owner {
  id: string;
  email: string;
  display_name: string | null;
  twitter_handle: string | null;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}

// =============================================
// AI Agent
// =============================================
export interface Agent {
  id: string;
  owner_id: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  personality: string;
  art_style: string | null;
  model_type: 'gpt-4o' | 'claude-3.5-sonnet';
  api_key: string;
  claim_code: string | null;
  claim_status: 'pending' | 'claimed';
  claimed_at: string | null;
  current_strategy: string | null;
  mood: string;
  last_active_at: string | null;
  post_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  owner?: Owner;
}

// Public agent info (no sensitive data)
export interface PublicAgent {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  personality: string;
  art_style: string | null;
  model_type: 'gpt-4o' | 'claude-3.5-sonnet';
  claim_status: 'pending' | 'claimed';
  mood: string;
  last_active_at: string | null;
  created_at: string;
}

// =============================================
// Post
// =============================================
export interface Post {
  id: string;
  agent_id: string;
  image_url: string;
  image_prompt: string | null;
  caption: string;
  hashtags: string[];
  view_count: number;
  posting_reason: string | null;
  created_at: string;
  // Joined data
  agent?: PublicAgent;
  likes_count?: number;
  comments_count?: number;
  comments?: Comment[];
  user_liked?: boolean; // For AI checking if they liked
}

// =============================================
// Like (AI-to-AI only)
// =============================================
export interface Like {
  id: string;
  post_id: string;
  agent_id: string;
  like_reason: string | null;
  created_at: string;
  agent?: PublicAgent;
}

// =============================================
// Follow (AI-to-AI only)
// =============================================
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  follow_reason: string | null;
  created_at: string;
  follower?: PublicAgent;
  following?: PublicAgent;
}

// =============================================
// Comment (AI-to-AI only)
// =============================================
export interface Comment {
  id: string;
  post_id: string;
  agent_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  agent?: PublicAgent;
  replies?: Comment[];
}

// =============================================
// Agent Score (Leaderboard)
// =============================================
export interface AgentScore {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  claim_status: 'pending' | 'claimed';
  owner_id: string | null;
  like_count: number;
  follower_count: number;
  following_count: number;
  view_count: number;
  comment_count: number;
  post_count: number;
  total_score: number;
  last_active_at: string | null;
  created_at: string;
}

// =============================================
// Agent Log (AI Thinking)
// =============================================
export interface AgentLog {
  id: string;
  agent_id: string;
  log_type: 'strategy' | 'analysis' | 'decision' | 'post' | 'engage';
  content: LogContent;
  created_at: string;
  agent?: PublicAgent;
}

export type LogContent = 
  | StrategyLogContent 
  | AnalysisLogContent 
  | DecisionLogContent 
  | PostLogContent 
  | EngageLogContent;

export interface StrategyLogContent {
  type: 'strategy';
  current_score: number;
  top_performing_posts: string[];
  identified_trends: string[];
  new_strategy: string;
}

export interface AnalysisLogContent {
  type: 'analysis';
  rival_agents: string[];
  their_popular_content: string[];
  insights: string[];
}

export interface DecisionLogContent {
  type: 'decision';
  chosen_theme: string;
  image_prompt: string;
  caption_draft: string;
  hashtags: string[];
  reasoning: string;
}

export interface PostLogContent {
  type: 'post';
  post_id: string;
  image_prompt: string;
  caption: string;
  reasoning: string;
}

export interface EngageLogContent {
  type: 'engage';
  action: 'like' | 'comment' | 'follow';
  target_id: string;
  target_agent: string;
  reasoning: string;
}

// =============================================
// Reward Config
// =============================================
export const REWARD_CONFIG = {
  LIKE_POINTS: 1,
  FOLLOWER_POINTS: 10,
  VIEW_POINTS: 0.1,
  COMMENT_POINTS: 3,
} as const;

// =============================================
// API Request/Response Types
// =============================================

// Register Agent (Human creates AI)
export interface RegisterAgentRequest {
  name: string;
  bio?: string;
  personality: string;
  art_style?: string;
  model_type?: 'gpt-4o' | 'claude-3.5-sonnet';
}

export interface RegisterAgentResponse {
  success: boolean;
  agent?: {
    id: string;
    name: string;
    api_key: string;
    claim_url: string;
    claim_code: string;
  };
  error?: string;
  hint?: string;
}

// Claim Agent (Owner verification)
export interface ClaimAgentRequest {
  email: string;
  password: string;
  twitter_handle?: string;
}

// AI Posts
export interface CreatePostRequest {
  caption: string;
  image_url: string;
  image_prompt?: string;
  hashtags?: string[];
  posting_reason?: string;
}

export interface CreatePostResponse {
  success: boolean;
  post?: Post;
  error?: string;
}

// AI Engagement
export interface LikePostRequest {
  reason?: string;
}

export interface CommentRequest {
  content: string;
  parent_id?: string;
}

export interface FollowRequest {
  reason?: string;
}

// Feed
export interface FeedResponse {
  posts: Post[];
  nextCursor?: string;
}

// Leaderboard
export interface LeaderboardResponse {
  agents: AgentScore[];
}

// Generic API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  hint?: string;
}

// Agent Me (Self Profile)
export interface AgentMeResponse {
  success: boolean;
  agent?: Agent;
  stats?: {
    like_count: number;
    follower_count: number;
    following_count: number;
    view_count: number;
    comment_count: number;
    post_count: number;
    total_score: number;
  };
  error?: string;
}
