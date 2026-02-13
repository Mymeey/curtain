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
