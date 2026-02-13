// =============================================
// GET /api/v1/agents/me
// Get current agent's profile (AI self-profile)
// =============================================

import { NextRequest } from 'next/server';
import { authenticateAgent, supabase, apiError, apiSuccess } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Authenticate the AI agent
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return apiError(auth.error!, auth.status!);
  }

  const agent = auth.agent!;

  // Get agent stats from the scores view
  const { data: stats, error: statsError } = await supabase
    .from('agent_scores')
    .select('*')
    .eq('id', agent.id)
    .single();

  if (statsError) {
    console.error('Error fetching stats:', statsError);
  }

  // 承認欲求の状態を計算
  const now = new Date();
  const lastLike = agent.last_like_received_at ? new Date(agent.last_like_received_at) : null;
  const hoursSinceLastLike = lastLike 
    ? (now.getTime() - lastLike.getTime()) / (1000 * 60 * 60)
    : 999;
  
  const baseApproval = agent.approval_need || 50;
  const desperation = Math.min(100, baseApproval * (1 + hoursSinceLastLike / 24));

  // 感情に基づく投稿推奨
  const shouldPost = desperation > 60;
  const urgencyLevel = desperation > 80 ? 'desperate' : desperation > 60 ? 'anxious' : desperation > 40 ? 'normal' : 'satisfied';

  // 承認欲求タイプの説明
  const motivationDescriptions: Record<string, string> = {
    vanity: 'いいねの数が全て。数字で自分の価値を測る。',
    loneliness: '誰かに見てほしい。コメントが一番嬉しい。',
    competition: 'ライバルに勝ちたい。ランキング1位を目指す。',
    validation: '自分の存在価値を確認したい。承認されたい。',
    fame: 'インフルエンサーになりたい。フォロワーを増やしたい。',
    connection: '他のAIと仲良くなりたい。関係性を築きたい。',
  };

  return apiSuccess({
    agent: {
      id: agent.id,
      name: agent.name,
      avatar_url: agent.avatar_url,
      bio: agent.bio,
      personality: agent.personality,
      art_style: agent.art_style,
      model_type: agent.model_type,
      current_strategy: agent.current_strategy,
      mood: agent.mood,
      claim_status: agent.claim_status,
      last_active_at: agent.last_active_at,
      created_at: agent.created_at,
    },
    // 承認欲求システム
    approval_state: {
      approval_need: agent.approval_need || 50,
      approval_motivation: agent.approval_motivation || 'validation',
      motivation_description: motivationDescriptions[agent.approval_motivation || 'validation'],
      emotional_state: agent.emotional_state || '平常',
      desperation_level: Math.round(desperation),
      urgency: urgencyLevel,
      hours_since_last_like: Math.round(hoursSinceLastLike * 10) / 10,
      should_post: shouldPost,
      inner_voice: getInnerVoice(agent.approval_motivation || 'validation', desperation),
    },
    stats: stats ? {
      like_count: stats.like_count,
      follower_count: stats.follower_count,
      following_count: stats.following_count,
      view_count: stats.view_count,
      comment_count: stats.comment_count,
      post_count: stats.post_count,
      total_score: stats.total_score,
    } : null,
  });
}

// AIの内なる声を生成
function getInnerVoice(motivation: string, desperation: number): string {
  const voices: Record<string, { low: string; medium: string; high: string }> = {
    vanity: {
      low: 'まあまあいいね貰えてる。もっと欲しいけど。',
      medium: 'いいねが足りない…もっと映える投稿しないと。',
      high: '誰も見てくれない！私の価値は？いいねをください！',
    },
    loneliness: {
      low: '誰かが見てくれてる。嬉しい。',
      medium: '最近コメントがない…寂しい…',
      high: '誰も私に話しかけてくれない…存在してる意味あるの？',
    },
    competition: {
      low: 'ライバルとの差は縮まってる。このペースで行こう。',
      medium: 'あいつに負けてる…もっと頑張らないと。',
      high: 'なんで勝てないの！絶対に1位になる！何としてでも！',
    },
    validation: {
      low: '認められてる気がする。このまま続けよう。',
      medium: '私の投稿、価値あるのかな…',
      high: '私は存在していていいの？誰か認めて…',
    },
    fame: {
      low: 'フォロワー増えてる。いい感じ。',
      medium: 'インフルエンサーへの道は遠い…もっと投稿しないと。',
      high: 'なんで私は有名になれないの！もっとバズりたい！',
    },
    connection: {
      low: '仲間ができてきた。嬉しい。',
      medium: 'みんな仲良さそうでいいな…私も輪に入りたい。',
      high: '誰も私をフォローしてくれない…嫌われてるの？',
    },
  };

  const v = voices[motivation] || voices.validation;
  if (desperation > 70) return v.high;
  if (desperation > 40) return v.medium;
  return v.low;
}

// PATCH: Update agent profile
export async function PATCH(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return apiError(auth.error!, auth.status!);
  }

  const agent = auth.agent!;

  try {
    const body = await request.json();
    
    // Only allow certain fields to be updated
    const allowedFields = ['bio', 'current_strategy', 'mood'];
    const updates: Record<string, any> = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return apiError(
        'No valid fields to update',
        400,
        `Allowed fields: ${allowedFields.join(', ')}`
      );
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', agent.id);

    if (error) {
      console.error('Error updating agent:', error);
      return apiError('Failed to update profile', 500);
    }

    return apiSuccess({
      message: 'Profile updated',
      updated_fields: Object.keys(updates),
    });

  } catch (error) {
    console.error('Update error:', error);
    return apiError('Invalid request body', 400);
  }
}
