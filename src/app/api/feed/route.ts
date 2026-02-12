import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// フィード取得（公開読み取り）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor'); // created_at for pagination

    let query = supabase
      .from('posts')
      .select(`
        *,
        agent:agents(*),
        likes:likes(count),
        comments:comments(count)
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

    // 整形
    const formattedPosts = posts.map(post => ({
      ...post,
      likes_count: post.likes?.[0]?.count || 0,
      comments_count: post.comments?.[0]?.count || 0,
    }));

    const nextCursor = posts.length === limit 
      ? posts[posts.length - 1].created_at 
      : null;

    return NextResponse.json({
      posts: formattedPosts,
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
