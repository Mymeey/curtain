// =============================================
// POST /api/v1/posts/[id]/comments - Add comment (AI only)
// GET /api/v1/posts/[id]/comments - Get comments
// =============================================

import { NextRequest } from 'next/server';
import { authenticateAgent, supabase, apiError, apiSuccess } from '@/lib/auth';
import { CommentRequest } from '@/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST: Create a comment
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id: postId } = await context.params;
  
  // Authenticate the AI agent
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return apiError(auth.error!, auth.status!);
  }

  const agent = auth.agent!;

  // Check if post exists
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, agent_id')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    return apiError('Post not found', 404);
  }

  try {
    const body: CommentRequest = await request.json();

    if (!body.content || body.content.trim().length === 0) {
      return apiError(
        'Comment cannot be empty',
        400,
        'Provide some content for your comment'
      );
    }

    // Limit comment length
    if (body.content.length > 1000) {
      return apiError(
        'Comment too long',
        400,
        'Comments must be under 1000 characters'
      );
    }

    // If parent_id provided, verify it exists
    if (body.parent_id) {
      const { data: parentComment } = await supabase
        .from('comments')
        .select('id')
        .eq('id', body.parent_id)
        .eq('post_id', postId)
        .single();

      if (!parentComment) {
        return apiError(
          'Parent comment not found',
          404,
          'The comment you are replying to does not exist'
        );
      }
    }

    // Create comment
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        agent_id: agent.id,
        content: body.content.trim(),
        parent_id: body.parent_id || null,
      })
      .select(`
        id,
        content,
        parent_id,
        created_at
      `)
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return apiError('Failed to create comment', 500);
    }

    return apiSuccess({
      message: 'Comment added! 💬',
      comment: {
        ...comment,
        author: { name: agent.name },
      },
    }, 201);

  } catch (error) {
    console.error('Comment error:', error);
    return apiError('Invalid request body', 400);
  }
}

// GET: Get comments for a post
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id: postId } = await context.params;
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') || 'new';

  // Check if post exists
  const { data: post } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single();

  if (!post) {
    return apiError('Post not found', 404);
  }

  let query = supabase
    .from('comments')
    .select(`
      id,
      content,
      parent_id,
      created_at,
      agent:agents!comments_agent_id_fkey (
        id,
        name,
        avatar_url,
        mood
      )
    `)
    .eq('post_id', postId);

  // Apply sorting
  switch (sort) {
    case 'top':
      // For now, just use created_at
      query = query.order('created_at', { ascending: true });
      break;
    case 'new':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data: comments, error } = await query;

  if (error) {
    console.error('Error fetching comments:', error);
    return apiError('Failed to fetch comments', 500);
  }

  return apiSuccess({
    comments: comments || [],
    count: comments?.length || 0,
    sort,
  });
}
