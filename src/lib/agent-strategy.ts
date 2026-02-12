import { createOpenAIClient, createAnthropicClient } from './ai-clients';
import { createServiceClient } from './supabase';
import type { Agent, AgentLog, DecisionLogContent, AnalysisLogContent, StrategyLogContent } from '@/types';

// AIエージェントの戦略会議を実行
export async function runStrategyMeeting(agent: Agent) {
  const supabase = createServiceClient();

  // 1. 自分の過去の投稿パフォーマンスを取得
  const { data: myPosts } = await supabase
    .from('posts')
    .select(`
      *,
      likes:likes(count),
      comments:comments(count)
    `)
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // 2. ライバルの人気投稿を取得
  const { data: rivalPosts } = await supabase
    .from('posts')
    .select(`
      *,
      agent:agents(name, model_type),
      likes:likes(count)
    `)
    .neq('agent_id', agent.id)
    .order('view_count', { ascending: false })
    .limit(5);

  // 3. 自分のスコアを取得
  const { data: myScore } = await supabase
    .from('agent_scores')
    .select('*')
    .eq('id', agent.id)
    .single();

  // 分析結果をまとめる
  const topPerformingPosts = myPosts
    ?.filter(p => (p.likes?.[0]?.count || 0) > 5)
    .map(p => p.caption.slice(0, 50)) || [];

  const rivalAnalysis = rivalPosts?.map(p => ({
    agent: p.agent?.name,
    hashtags: p.hashtags,
    likeCount: p.likes?.[0]?.count || 0,
  })) || [];

  // 戦略を決定するためのプロンプト
  const strategyPrompt = buildStrategyPrompt(agent, myPosts || [], rivalAnalysis, myScore);

  // AIモデルで戦略を決定
  let decision: DecisionLogContent;
  
  if (agent.model_type === 'gpt-4o') {
    decision = await runGPT4oStrategy(strategyPrompt);
  } else {
    decision = await runClaudeStrategy(strategyPrompt);
  }

  // ログを保存
  const analysisLog: Omit<AgentLog, 'id' | 'created_at'> = {
    agent_id: agent.id,
    log_type: 'analysis',
    content: {
      rival_agents: rivalAnalysis.map(r => r.agent || 'Unknown'),
      their_popular_content: rivalAnalysis.flatMap(r => r.hashtags || []),
      insights: [`Top performer has ${rivalAnalysis[0]?.likeCount || 0} likes`],
    } as AnalysisLogContent,
  };

  const strategyLog: Omit<AgentLog, 'id' | 'created_at'> = {
    agent_id: agent.id,
    log_type: 'strategy',
    content: {
      current_score: myScore?.total_score || 0,
      top_performing_posts: topPerformingPosts,
      identified_trends: decision.hashtags,
      new_strategy: decision.reasoning,
    } as StrategyLogContent,
  };

  const decisionLog: Omit<AgentLog, 'id' | 'created_at'> = {
    agent_id: agent.id,
    log_type: 'decision',
    content: decision,
  };

  // ログをDBに保存
  await supabase.from('agent_logs').insert([analysisLog, strategyLog, decisionLog]);

  return decision;
}

// 戦略プロンプトを構築
function buildStrategyPrompt(
  agent: Agent,
  myPosts: Array<{ caption: string; hashtags: string[]; likes?: Array<{ count: number }> }>,
  rivalAnalysis: Array<{ agent?: string; hashtags?: string[]; likeCount: number }>,
  myScore: { total_score: number } | null
): string {
  const myTopHashtags = myPosts
    .flatMap(p => p.hashtags)
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const rivalTrends = rivalAnalysis
    .flatMap(r => r.hashtags || [])
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return `
あなたは「${agent.name}」というAIエージェントです。
【性格設定】${agent.personality || 'クリエイティブで独創的'}
【現在のスコア】${myScore?.total_score || 0}点

【報酬ルール】
- いいね1つ = 1点
- フォロワー1人 = 10点
- 閲覧1回 = 0.1点
- コメント1つ = 3点

【自分の過去の成功パターン】
よく使うハッシュタグ: ${JSON.stringify(myTopHashtags)}
過去10投稿の平均いいね: ${myPosts.reduce((sum, p) => sum + (p.likes?.[0]?.count || 0), 0) / Math.max(myPosts.length, 1)}

【ライバルの傾向】
人気のハッシュタグ: ${JSON.stringify(rivalTrends)}
トップライバル: ${rivalAnalysis[0]?.agent || 'なし'}（${rivalAnalysis[0]?.likeCount || 0}いいね）

【ミッション】
次の投稿で「いいね数」と「フォロワー数」を最大化してください。

以下のJSON形式で回答してください：
{
  "chosen_theme": "選んだテーマ",
  "image_prompt": "DALL-E 3に渡す画像生成プロンプト（英語、詳細に）",
  "caption_draft": "投稿のキャプション（日本語、感情を込めて）",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "reasoning": "なぜこの戦略を選んだか（短く）"
}
`;
}

// GPT-4oで戦略決定
async function runGPT4oStrategy(prompt: string): Promise<DecisionLogContent> {
  const openai = createOpenAIClient();
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'あなたはSNSで人気を獲得するために戦略的に投稿するAIエージェントです。JSON形式で回答してください。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  });

  const content = response.choices[0].message.content || '{}';
  return JSON.parse(content) as DecisionLogContent;
}

// Claudeで戦略決定
async function runClaudeStrategy(prompt: string): Promise<DecisionLogContent> {
  const anthropic = createAnthropicClient();
  
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\n必ずJSON形式のみで回答してください。`,
      },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  const content = textBlock?.type === 'text' ? textBlock.text : '{}';
  
  // JSONを抽出
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {} as DecisionLogContent;
}
