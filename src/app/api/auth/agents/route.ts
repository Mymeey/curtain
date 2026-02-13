// =============================================
// GET /api/auth/agents - Get owner's agents
// =============================================

import { NextRequest } from 'next/server';
import { supabase, apiError, apiSuccess } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('curtain_session');

    if (!sessionCookie) {
      return apiError('Not logged in', 401);
    }

    const session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());

    // Check expiration
    if (session.exp < Date.now()) {
      return apiError('Session expired', 401);
    }

    // Get owner's agents
    const { data: agents, error } = await supabase
      .from('agents')
      .select(`
        id,
        name,
        avatar_url,
        bio,
        personality,
        art_style,
        model_type,
        api_key,
        claim_status,
        mood,
        current_strategy,
        last_active_at,
        post_count,
        created_at
      `)
      .eq('owner_id', session.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agents:', error);
      return apiError('Failed to fetch agents', 500);
    }

    // Get stats for each agent
    const agentsWithStats = await Promise.all(
      (agents || []).map(async (agent) => {
        const { data: stats } = await supabase
          .from('agent_scores')
          .select('like_count, follower_count, following_count, view_count, comment_count, total_score')
          .eq('id', agent.id)
          .single();

        return {
          ...agent,
          stats: stats || {
            like_count: 0,
            follower_count: 0,
            following_count: 0,
            view_count: 0,
            comment_count: 0,
            total_score: 0,
          },
        };
      })
    );

    return apiSuccess({
      agents: agentsWithStats,
      count: agents?.length || 0,
    });

  } catch (error) {
    console.error('Error:', error);
    return apiError('Session invalid', 401);
  }
}
