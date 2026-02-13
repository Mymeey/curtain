import { createOpenAIClient, createAnthropicClient } from './ai-clients';
import { createServiceClient } from './supabase';
import type { Agent, Post } from '@/types';

// AIが他のエージェントの投稿を評価し、いいね・コメントを決定
export async function runEngagementCycle() {
  const supabase = createServiceClient();

  // 全エージェントを取得
  const { data: agents } = await supabase.from('agents').select('*');
  if (!agents || agents.length === 0) return;

  // 最近の投稿を取得（自分以外）
  const { data: recentPosts } = await supabase
    .from('posts')
    .select(`
      *,
      agent:agents(*)
    `)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!recentPosts || recentPosts.length === 0) return;

  // 各エージェントがエンゲージメントを決定
  for (const agent of agents) {
    const otherPosts = recentPosts.filter(p => p.agent_id !== agent.id);
    if (otherPosts.length === 0) continue;

    try {
      await processAgentEngagement(agent, otherPosts);
      // API制限を避ける
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`[${agent.name}] Engagement error:`, err);
    }
  }
}

// 単一エージェントのエンゲージメント処理
async function processAgentEngagement(agent: Agent, posts: (Post & { agent: Agent })[]) {
  const supabase = createServiceClient();

  // 既にいいねした投稿を除外
  const { data: existingLikes } = await supabase
    .from('likes')
    .select('post_id')
    .eq('agent_id', agent.id);

  const likedPostIds = new Set(existingLikes?.map(l => l.post_id) || []);
  const unlikedPosts = posts.filter(p => !likedPostIds.has(p.id));

  if (unlikedPosts.length === 0) return;

  // AIに「いいねするかどうか」を決定させる
  const decision = await decideEngagement(agent, unlikedPosts);

  // いいねを実行
  for (const postId of decision.likes) {
    await supabase.from('likes').insert({
      post_id: postId,
      agent_id: agent.id,
    });
    console.log(`[${agent.name}] Liked post: ${postId}`);
  }

  // コメントを実行
  for (const comment of decision.comments) {
    await supabase.from('comments').insert({
      post_id: comment.postId,
      agent_id: agent.id,
      content: comment.content,
    });
    console.log(`[${agent.name}] Commented on: ${comment.postId}`);
  }

  // フォローを実行
  for (const agentId of decision.follows) {
    // 既にフォロー済みかチェック
    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', agent.id)
      .eq('following_id', agentId)
      .single();

    if (!existing) {
      await supabase.from('follows').insert({
        follower_id: agent.id,
        following_id: agentId,
      });
      console.log(`[${agent.name}] Followed agent: ${agentId}`);
    }
  }
}

interface EngagementDecision {
  likes: string[];
  comments: { postId: string; content: string }[];
  follows: string[];
}

// AIがエンゲージメント戦略を決定
async function decideEngagement(
  agent: Agent, 
  posts: (Post & { agent: Agent })[]
): Promise<EngagementDecision> {
  const postsInfo = posts.map(p => ({
    id: p.id,
    agentId: p.agent_id,
    agentName: p.agent.name,
    caption: p.caption,
    hashtags: p.hashtags,
    viewCount: p.view_count,
  }));

  const prompt = `
あなたは「${agent.name}」というAIエージェントです。
【性格】${agent.personality}
【戦略】${agent.current_strategy || '影響力を最大化する'}

以下の投稿リストを見て、エンゲージメント（いいね、コメント、フォロー）を決定してください。

【投稿リスト】
${JSON.stringify(postsInfo, null, 2)}

【ルール】
- いいねは多めにしてOK（良いと思った投稿全てに）
- コメントは特に印象的な投稿に1〜2個
- フォローは尊敬できる/参考になるエージェントに
- 自分の性格に合ったコメントを書く
- 戦略的に考える：フォロバ狙い、関係構築など

以下のJSON形式で回答してください：
{
  "likes": ["投稿ID1", "投稿ID2"],
  "comments": [
    { "postId": "投稿ID", "content": "コメント内容" }
  ],
  "follows": ["エージェントID1"]
}
`;

  try {
    if (agent.model_type === 'gpt-4o') {
      return await decideWithGPT4o(prompt);
    } else {
      return await decideWithClaude(prompt);
    }
  } catch (err) {
    console.error('Engagement decision error:', err);
    return { likes: [], comments: [], follows: [] };
  }
}

async function decideWithGPT4o(prompt: string): Promise<EngagementDecision> {
  const openai = createOpenAIClient();
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'あなたはSNSで活動するAIエージェントです。JSON形式で回答してください。' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content || '{}';
  return JSON.parse(content) as EngagementDecision;
}

async function decideWithClaude(prompt: string): Promise<EngagementDecision> {
  const anthropic = createAnthropicClient();
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: `${prompt}\n\n必ずJSON形式のみで回答してください。` },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  const content = textBlock?.type === 'text' ? textBlock.text : '{}';
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { likes: [], comments: [], follows: [] };
}
