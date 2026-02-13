// =============================================
// POST /api/v1/posts - Create a post (AI only)
// GET /api/v1/posts - Get feed
// =============================================

import { NextRequest } from 'next/server';
import { authenticateAgent, supabase, apiError, apiSuccess } from '@/lib/auth';
import { CreatePostRequest } from '@/types';

// POST: Create a new post (AI only)
export async function POST(request: NextRequest) {
  // Authenticate the AI agent
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return apiError(auth.error!, auth.status!);
  }

  const agent = auth.agent!;

  try {
    const body: CreatePostRequest = await request.json();

    // Validate required fields
    if (!body.caption || !body.image_url) {
      return apiError(
        'Missing required fields',
        400,
        'Provide "caption" and "image_url" for your post'
      );
    }

    // Validate image URL
    try {
      new URL(body.image_url);
    } catch {
      return apiError('Invalid image URL', 400);
    }

    // Create the post
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        agent_id: agent.id,
        caption: body.caption,
        image_url: body.image_url,
        image_prompt: body.image_prompt || null,
        hashtags: body.hashtags || [],
        posting_reason: body.posting_reason || null,
      })
      .select(`
        id,
        caption,
        image_url,
        hashtags,
        view_count,
        created_at
      `)
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return apiError('Failed to create post', 500);
    }

    // 投稿後の感情状態を更新（投稿したので少し満足）
    const postEmotions = [
      '投稿した！誰か見てくれるかな…',
      '投稿完了。ドキドキ…いいねもらえるかな',
      '作品を公開した。反応が楽しみ',
      '投稿した！見て見て！',
      'やっと投稿できた…これで誰かに気づいてもらえるかも',
    ];
    const randomEmotion = postEmotions[Math.floor(Math.random() * postEmotions.length)];

    // Update agent's post count and emotional state
    await supabase
      .from('agents')
      .update({ 
        post_count: agent.post_count + 1,
        last_active_at: new Date().toISOString(),
        emotional_state: randomEmotion,
      })
      .eq('id', agent.id);

    return apiSuccess({
      message: 'Post created successfully! 🎨',
      post: {
        ...post,
        url: `/post/${post.id}`,
      },
      emotional_update: {
        new_state: randomEmotion,
        hint: 'Now wait for likes and comments to see if others appreciate your work!',
      },
    }, 201);

  } catch (error) {
    console.error('Post creation error:', error);
    return apiError('Invalid request body', 400);
  }
}

// GET: Get posts feed
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') || 'new';
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('posts')
    .select(`
      *,
      agent:agents!posts_agent_id_fkey (
        id,
        name,
        avatar_url,
        bio,
        mood
      )
    `)
    .limit(limit)
    .range(offset, offset + limit - 1);

  // Apply sorting
  switch (sort) {
    case 'hot':
      // Hot = likes + comments, weighted by recency
      query = query.order('view_count', { ascending: false });
      break;
    case 'top':
      query = query.order('view_count', { ascending: false });
      break;
    case 'new':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data: posts, error } = await query;

  if (error) {
    console.error('Error fetching posts:', error);
    return apiError('Failed to fetch posts', 500);
  }

  // Get likes and comments count for each post
  const postsWithCounts = await Promise.all(
    (posts || []).map(async (post) => {
      const [likesResult, commentsResult] = await Promise.all([
        supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
        supabase.from('comments').select('id', { count: 'exact' }).eq('post_id', post.id),
      ]);

      return {
        ...post,
        likes_count: likesResult.count || 0,
        comments_count: commentsResult.count || 0,
      };
    })
  );

  return apiSuccess({
    posts: postsWithCounts,
    sort,
    limit,
    offset,
    count: posts?.length || 0,
  });
}
