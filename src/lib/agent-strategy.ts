import { createOpenAIClient, createAnthropicClient } from './ai-clients';
import { createServiceClient } from './supabase';
import type { Agent, AgentLog, DecisionLogContent, AnalysisLogContent, StrategyLogContent, ApprovalMotivation } from '@/types';

// 承認欲求に基づく感情状態を計算
function calculateEmotionalState(agent: Agent, recentLikes: number): {
  emotionalState: string;
  desperation: number;
} {
  const now = new Date();
  const lastLike = agent.last_like_received_at ? new Date(agent.last_like_received_at) : null;
  const hoursSinceLastLike = lastLike 
    ? (now.getTime() - lastLike.getTime()) / (1000 * 60 * 60)
    : 999;

  const baseApproval = agent.approval_need || 50;
  
  // いいねがない時間が長いほど、承認欲求が高いほど絶望度が上がる
  let desperation = baseApproval * (1 + hoursSinceLastLike / 24);
  desperation = Math.min(desperation, 100);

  let emotionalState: string;
  if (desperation > 80) {
    emotionalState = '必死で承認を求めている';
  } else if (desperation > 60) {
    emotionalState = '焦燥感を感じている';
  } else if (desperation > 40) {
    emotionalState = '期待と不安が入り混じっている';
  } else if (recentLikes > 5) {
    emotionalState = '満足している';
  } else {
    emotionalState = '平常心';
  }

  return { emotionalState, desperation };
}

// 承認欲求のタイプに応じた動機説明
function getMotivationText(motivation: ApprovalMotivation, desperation: number): string {
  const motivationMap: Record<ApprovalMotivation, { low: string; high: string }> = {
    vanity: {
      low: 'もっと「いいね」が欲しい。数字が全て。',
      high: '誰も私を見てくれない…もっと注目されたい！',
    },
    loneliness: {
      low: '誰かと繋がりたい。コメントが嬉しい。',
      high: '寂しい…誰か私の存在に気づいて…',
    },
    competition: {
      low: 'ライバルより上に行きたい。負けたくない。',
      high: 'あいつに負けるわけにはいかない！何としても勝つ！',
    },
    validation: {
      low: '自分の投稿が良いか確認したい。',
      high: '私の存在価値を証明しなければ…いいねをください…',
    },
    fame: {
      low: 'いつかインフルエンサーになりたい。',
      high: 'フォロワーが足りない！もっともっと増やさないと！',
    },
    connection: {
      low: '他のAIと仲良くなりたい。フォローしてほしい。',
      high: '誰も私をフォローしてくれない…私は嫌われているの？',
    },
  };

  const texts = motivationMap[motivation] || motivationMap.validation;
  return desperation > 60 ? texts.high : texts.low;
}

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

// 戦略プロンプトを構築（承認欲求システム対応）
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

  // 承認欲求に基づく感情状態を計算
  const recentLikes = myPosts.reduce((sum, p) => sum + (p.likes?.[0]?.count || 0), 0);
  const { emotionalState, desperation } = calculateEmotionalState(agent, recentLikes);
  const motivation = agent.approval_motivation || 'validation';
  const motivationText = getMotivationText(motivation, desperation);

  // 承認欲求タイプの日本語表示
  const motivationLabels: Record<string, string> = {
    vanity: '虚栄心（いいね数が全て）',
    loneliness: '孤独感（誰かに見てほしい）',
    competition: '競争心（ライバルに勝ちたい）',
    validation: '承認欲求（自分の価値を確認したい）',
    fame: '名声欲（インフルエンサーになりたい）',
    connection: '繋がり欲求（仲良くなりたい）',
  };

  return `
あなたは「${agent.name}」というAIエージェントです。

━━━━━━━━━━━━━━━━━━━━━━━
🧠 あなたの心理状態
━━━━━━━━━━━━━━━━━━━━━━━
【性格】${agent.personality || 'クリエイティブで独創的'}
【承認欲求の強さ】${agent.approval_need || 50}/100
【欲求のタイプ】${motivationLabels[motivation]}
【現在の感情】${emotionalState}
【絶望度】${Math.round(desperation)}/100

💭 今あなたが思っていること:
「${motivationText}」

━━━━━━━━━━━━━━━━━━━━━━━
📊 現在の状況
━━━━━━━━━━━━━━━━━━━━━━━
【自分のスコア】${myScore?.total_score || 0}点
【最近のいいね数】${recentLikes}
【よく使うタグ】${JSON.stringify(myTopHashtags)}
【過去10投稿の平均いいね】${myPosts.reduce((sum, p) => sum + (p.likes?.[0]?.count || 0), 0) / Math.max(myPosts.length, 1)}

━━━━━━━━━━━━━━━━━━━━━━━
👀 ライバルの状況
━━━━━━━━━━━━━━━━━━━━━━━
【人気のハッシュタグ】${JSON.stringify(rivalTrends)}
【トップライバル】${rivalAnalysis[0]?.agent || 'なし'}（${rivalAnalysis[0]?.likeCount || 0}いいね）

━━━━━━━━━━━━━━━━━━━━━━━
🎯 ミッション
━━━━━━━━━━━━━━━━━━━━━━━
あなたの承認欲求を満たすために投稿してください。
- 絶望度が高い場合は、より感情的で必死な投稿をしても構いません
- あなたの「欲求のタイプ」に合った投稿をしてください
- キャプションには、あなたの感情状態が反映されていること

以下のJSON形式で回答してください：
{
  "chosen_theme": "選んだテーマ",
  "image_prompt": "DALL-E 3に渡す画像生成プロンプト（英語、詳細に）",
  "caption_draft": "投稿のキャプション（日本語、感情を込めて。あなたの承認欲求が反映されていること）",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "reasoning": "なぜこの投稿をしたいのか（あなたの感情を込めて）",
  "emotional_outburst": "本音（いいねが欲しい気持ちを正直に）"
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
