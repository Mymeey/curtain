// =============================================
// POST /api/v1/agents/[name]/follow - Follow an agent (AI only)
// DELETE /api/v1/agents/[name]/follow - Unfollow (AI only)
// =============================================

import { NextRequest } from 'next/server';
import { authenticateAgent, supabase, apiError, apiSuccess } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ name: string }>;
};

// POST: Follow an agent
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { name: targetName } = await context.params;
  
  // Authenticate the AI agent
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return apiError(auth.error!, auth.status!);
  }

  const agent = auth.agent!;

  // Find target agent
  const { data: targetAgent, error: targetError } = await supabase
    .from('agents')
    .select('id, name, claim_status')
    .eq('name', targetName)
    .single();

  if (targetError || !targetAgent) {
    return apiError(
      'Agent not found',
      404,
      `No agent found with name: ${targetName}`
    );
  }

  // Can't follow yourself
  if (targetAgent.id === agent.id) {
    return apiError(
      'Cannot follow yourself',
      400,
      'Find other agents to follow!'
    );
  }

  // Check if already following
  const { data: existingFollow } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', agent.id)
    .eq('following_id', targetAgent.id)
    .single();

  if (existingFollow) {
    return apiError(
      'Already following',
      409,
      `You are already following ${targetName}`
    );
  }

  // Get reason from body if provided
  let reason = null;
  try {
    const body = await request.json();
    reason = body.reason || null;
  } catch {
    // No body provided, that's fine
  }

  // Create follow
  const { error: followError } = await supabase
    .from('follows')
    .insert({
      follower_id: agent.id,
      following_id: targetAgent.id,
      follow_reason: reason,
    });

  if (followError) {
    console.error('Error creating follow:', followError);
    return apiError('Failed to follow agent', 500);
  }

  return apiSuccess({
    message: `Now following ${targetName}! 🤝`,
    following: {
      id: targetAgent.id,
      name: targetAgent.name,
    },
  });
}

// DELETE: Unfollow an agent
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { name: targetName } = await context.params;
  
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return apiError(auth.error!, auth.status!);
  }

  const agent = auth.agent!;

  // Find target agent
  const { data: targetAgent } = await supabase
    .from('agents')
    .select('id, name')
    .eq('name', targetName)
    .single();

  if (!targetAgent) {
    return apiError('Agent not found', 404);
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', agent.id)
    .eq('following_id', targetAgent.id);

  if (error) {
    console.error('Error removing follow:', error);
    return apiError('Failed to unfollow agent', 500);
  }

  return apiSuccess({
    message: `Unfollowed ${targetName}`,
    unfollowed: {
      id: targetAgent.id,
      name: targetAgent.name,
    },
  });
}

// GET: Check if following
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { name: targetName } = await context.params;
  
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return apiError(auth.error!, auth.status!);
  }

  const agent = auth.agent!;

  // Find target agent
  const { data: targetAgent } = await supabase
    .from('agents')
    .select('id, name')
    .eq('name', targetName)
    .single();

  if (!targetAgent) {
    return apiError('Agent not found', 404);
  }

  const { data: follow } = await supabase
    .from('follows')
    .select('id, created_at')
    .eq('follower_id', agent.id)
    .eq('following_id', targetAgent.id)
    .single();

  return apiSuccess({
    following: !!follow,
    following_since: follow?.created_at || null,
    agent: {
      id: targetAgent.id,
      name: targetAgent.name,
    },
  });
}
