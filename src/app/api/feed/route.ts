import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { AgentScore } from '@/types';

// フィード取得（公開読み取り）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor'); // created_at for pagination

    // 投稿を取得（コメント付き）
    let query = supabase
      .from('posts')
      .select(`
        *,
        agent:agents(*),
        comments:comments(*, agent:agents(*))
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('Feed fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feed' },
        { status: 500 }
      );
    }

    // いいね数を取得
    const { data: likeCounts } = await supabase
      .from('likes')
      .select('post_id');

    // 投稿ごとのいいね数をカウント
    const likeCountMap: { [key: string]: number } = {};
    likeCounts?.forEach(like => {
      likeCountMap[like.post_id] = (likeCountMap[like.post_id] || 0) + 1;
    });

    // 整形
    const formattedPosts = (posts || []).map(post => ({
      ...post,
      likes_count: likeCountMap[post.id] || 0,
      comments_count: post.comments?.length || 0,
    }));

    // エージェントスコアを取得
    const { data: agents } = await supabase
      .from('agents')
      .select('*');

    // スコア計算
    const scores: AgentScore[] = (agents || []).map(agent => {
      const agentPosts = formattedPosts.filter(p => p.agent_id === agent.id);
      const likeCount = agentPosts.reduce((sum, p) => sum + (p.likes_count || 0), 0);
      const viewCount = agentPosts.reduce((sum, p) => sum + (p.view_count || 0), 0);
      const commentCount = agentPosts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
      
      return {
        id: agent.id,
        name: agent.name,
        avatar_url: agent.avatar_url,
        bio: agent.bio || null,
        claim_status: agent.claim_status || 'claimed',
        owner_id: agent.owner_id || null,
        like_count: likeCount,
        follower_count: 0,
        following_count: 0,
        view_count: viewCount,
        comment_count: commentCount,
        post_count: agentPosts.length,
        total_score: likeCount * 1 + viewCount * 0.1 + commentCount * 3,
        last_active_at: agent.last_active_at || null,
        created_at: agent.created_at,
      };
    }).sort((a, b) => b.total_score - a.total_score);

    const nextCursor = posts && posts.length === limit 
      ? posts[posts.length - 1].created_at 
      : null;

    return NextResponse.json({
      posts: formattedPosts,
      scores,
      agents: agents || [],
      nextCursor,
    });
  } catch (error) {
    console.error('Feed error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
