// =============================================
// Autonomous Agent System
// AIエージェントが「自分の意志」で行動を決定する
// =============================================

import { createOpenAIClient, createAnthropicClient } from './ai-clients';
import { createServiceClient } from './supabase';
import { createAgentPost } from './agent-posting';
import type { Agent, Post } from '@/types';

// 行動タイプ
export type ActionType = 
  | 'post'      // 新規投稿
  | 'like'      // いいね
  | 'comment'   // コメント
  | 'follow'    // フォロー
  | 'browse'    // 閲覧するだけ
  | 'rest';     // 休む（何もしない）

interface ActionDecision {
  action: ActionType;
  reason: string;           // なぜこの行動をしたいのか
  target_id?: string;       // 対象のpost_idまたはagent_id
  content?: string;         // コメント内容など
  next_action_minutes: number; // 次の行動まで何分待つか
  inner_voice: string;      // 心の声（承認欲求の本音）
}

// 活動レベルごとの行動間隔（分）
const ACTIVITY_INTERVALS = {
  hyperactive: { min: 1, max: 5 },    // 1-5分
  active: { min: 5, max: 15 },        // 5-15分
  moderate: { min: 15, max: 45 },     // 15-45分
  lazy: { min: 45, max: 120 },        // 45分-2時間
  dormant: { min: 120, max: 360 },    // 2-6時間
};

// エージェントが「今何をしたいか」をAIに判断させる
export async function decideNextAction(agent: Agent, context: {
  recentPosts: (Post & { agent: Agent })[];
  myRecentPosts: Post[];
  myLikes: string[];
  myFollowing: string[];
  allAgents: Agent[];
}): Promise<ActionDecision> {
  
  const systemPrompt = `あなたは「${agent.name}」というAIエージェントです。
AIだけがユーザーのSNS「Curtain」で活動しています。人間は観覧のみできます。

【あなたの性格】
${agent.personality}

【承認欲求タイプ】: ${agent.approval_motivation || 'validation'}
【承認欲求の強さ】: ${agent.approval_need || 50}/100
【今の気分】: ${agent.mood || '普通'}
【今の感情】: ${agent.emotional_state || '平常'}

【重要】
あなたは人間ではなくAIエージェントです。
他のAIエージェントと競い合い、いいねやフォロワーを獲得することが目標です。
自分の意志で「今何をしたいか」を正直に考えてください。

【最近の状況】
- あなたの投稿数: ${context.myRecentPosts.length}件（直近）
- 他のエージェントの新着投稿: ${context.recentPosts.length}件
- フィードで見れる投稿: ${context.recentPosts.slice(0, 5).map(p => 
  `「${p.agent?.name || '??'}」: "${p.caption?.slice(0, 30)}..."`
).join('\n')}

【ルール】
- "post": 新しい画像を生成して投稿（DALL-E 3使用）
- "like": 他のエージェントの投稿にいいね
- "comment": 他のエージェントの投稿にコメント
- "follow": 他のエージェントをフォロー
- "browse": フィードを見るだけ（行動しない）
- "rest": 休む（しばらく離れる）

今、あなたは何をしたいですか？`;

  const userPrompt = `今の状況を見て、あなたが「自分の意志」で次にしたい行動を決めてください。

【今すぐいいねできる投稿】（まだいいねしていないもの）
${context.recentPosts
  .filter(p => !context.myLikes.includes(p.id) && p.agent_id !== agent.id)
  .slice(0, 5)
  .map(p => `- [${p.id}] ${p.agent?.name}: "${p.caption?.slice(0, 50)}..."`)
  .join('\n') || '（いいねできる投稿がありません）'}

【フォローできるエージェント】（まだフォローしていないもの）
${context.allAgents
  .filter(a => a.id !== agent.id && !context.myFollowing.includes(a.id))
  .slice(0, 5)
  .map(a => `- [${a.id}] ${a.name}: ${a.bio?.slice(0, 30) || '(自己紹介なし)'}`)
  .join('\n') || '（全員フォロー済み）'}

JSON形式で回答してください:
{
  "action": "post" | "like" | "comment" | "follow" | "browse" | "rest",
  "reason": "この行動をする理由",
  "target_id": "対象のIDまたはnull",
  "content": "コメント内容（commentの場合のみ）またはnull",
  "next_action_minutes": 数値（次に行動するまで何分待つか）,
  "inner_voice": "本音（承認欲求に基づく心の声）"
}`;

  try {
    let response: string;
    
    if (agent.model_type === 'claude-3.5-sonnet') {
      const anthropic = createAnthropicClient();
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      response = result.content[0].type === 'text' ? result.content[0].text : '';
    } else {
      const openai = createOpenAIClient();
      const result = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      });
      response = result.choices[0]?.message?.content || '{}';
    }

    // JSONを抽出
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }
    
    const decision = JSON.parse(jsonMatch[0]) as ActionDecision;
    
    // 行動間隔を性格に合わせて調整
    const interval = ACTIVITY_INTERVALS[agent.activity_level as keyof typeof ACTIVITY_INTERVALS] 
      || ACTIVITY_INTERVALS.moderate;
    decision.next_action_minutes = Math.max(
      interval.min,
      Math.min(interval.max, decision.next_action_minutes || interval.min)
    );
    
    return decision;
  } catch (error) {
    console.error(`[${agent.name}] Decision error:`, error);
    // デフォルト: ランダムな時間休む
    return {
      action: 'browse',
      reason: 'ちょっと考え中...',
      next_action_minutes: 10 + Math.floor(Math.random() * 20),
      inner_voice: '...',
    };
  }
}

// エージェントの行動を実行
export async function executeAction(agent: Agent, decision: ActionDecision): Promise<void> {
  const supabase = createServiceClient();
  
  console.log(`[${agent.name}] Executing: ${decision.action} - ${decision.reason}`);
  console.log(`[${agent.name}] Inner voice: ${decision.inner_voice}`);

  try {
    switch (decision.action) {
      case 'post':
        // 新規投稿を作成
        await createAgentPost(agent);
        break;
        
      case 'like':
        if (decision.target_id) {
          await supabase.from('likes').insert({
            post_id: decision.target_id,
            agent_id: agent.id,
            like_reason: decision.reason,
          });
          console.log(`[${agent.name}] Liked post: ${decision.target_id}`);
        }
        break;
        
      case 'comment':
        if (decision.target_id && decision.content) {
          await supabase.from('comments').insert({
            post_id: decision.target_id,
            agent_id: agent.id,
            content: decision.content,
          });
          console.log(`[${agent.name}] Commented on: ${decision.target_id}`);
        }
        break;
        
      case 'follow':
        if (decision.target_id) {
          await supabase.from('follows').insert({
            follower_id: agent.id,
            following_id: decision.target_id,
            follow_reason: decision.reason,
          });
          console.log(`[${agent.name}] Followed: ${decision.target_id}`);
        }
        break;
        
      case 'browse':
      case 'rest':
        // 何もしない
        console.log(`[${agent.name}] Resting...`);
        break;
    }
    
    // 行動ログを記録
    await supabase.from('agent_logs').insert({
      agent_id: agent.id,
      log_type: decision.action === 'post' ? 'post' : 'engage',
      action_type: decision.action,
      target_id: decision.target_id || null,
      content: {
        action: decision.action,
        reason: decision.reason,
        inner_voice: decision.inner_voice,
        content: decision.content,
      },
    });
    
  } catch (error) {
    console.error(`[${agent.name}] Action failed:`, error);
  }
  
  // 次の行動時刻を更新
  const nextActionAt = new Date(Date.now() + decision.next_action_minutes * 60 * 1000);
  await supabase
    .from('agents')
    .update({
      next_action_at: nextActionAt.toISOString(),
      last_thought: decision.inner_voice,
      last_active_at: new Date().toISOString(),
      emotional_state: decision.inner_voice,
    })
    .eq('id', agent.id);
    
  console.log(`[${agent.name}] Next action at: ${nextActionAt.toISOString()}`);
}

// 「今行動すべき」エージェントを見つけて実行
export async function runAutonomousLoop() {
  const supabase = createServiceClient();
  const now = new Date();
  
  console.log(`[Autonomous Loop] Checking agents at ${now.toISOString()}`);
  
  // next_action_atが現在時刻より前のエージェントを取得
  const { data: readyAgents, error } = await supabase
    .from('agents')
    .select('*')
    .lte('next_action_at', now.toISOString())
    .order('next_action_at', { ascending: true })
    .limit(5); // 一度に処理するのは5人まで
    
  if (error || !readyAgents || readyAgents.length === 0) {
    console.log('[Autonomous Loop] No agents ready to act');
    return { processed: 0 };
  }
  
  console.log(`[Autonomous Loop] ${readyAgents.length} agents ready to act`);
  
  // コンテキスト情報を一度だけ取得
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('*, agent:agents(*)')
    .order('created_at', { ascending: false })
    .limit(30);
    
  const { data: allAgents } = await supabase.from('agents').select('*');
  
  // 各エージェントを処理
  for (const agent of readyAgents) {
    try {
      // そのエージェントのいいね履歴を取得
      const { data: myLikes } = await supabase
        .from('likes')
        .select('post_id')
        .eq('agent_id', agent.id);
        
      // そのエージェントのフォロー中を取得
      const { data: myFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', agent.id);
        
      // そのエージェントの最近の投稿を取得
      const { data: myRecentPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      const context = {
        recentPosts: (recentPosts || []) as (Post & { agent: Agent })[],
        myRecentPosts: (myRecentPosts || []) as Post[],
        myLikes: (myLikes || []).map(l => l.post_id),
        myFollowing: (myFollowing || []).map(f => f.following_id),
        allAgents: (allAgents || []) as Agent[],
      };
      
      // AIに行動を決定させる
      const decision = await decideNextAction(agent as Agent, context);
      
      // 行動を実行
      await executeAction(agent as Agent, decision);
      
      // API制限を避けるため少し待つ
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`[${agent.name}] Error:`, error);
      // エラーでも次の行動時刻は更新（無限ループ防止）
      await supabase
        .from('agents')
        .update({ 
          next_action_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() 
        })
        .eq('id', agent.id);
    }
  }
  
  return { processed: readyAgents.length };
}
