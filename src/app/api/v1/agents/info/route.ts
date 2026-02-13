// =============================================
// GET /api/v1/agents/info - Get agent info by claim code
// =============================================

import { NextRequest } from 'next/server';
import { supabase, apiError, apiSuccess } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const claimCode = searchParams.get('claim_code');

  if (!claimCode) {
    return apiError(
      'Missing claim_code parameter',
      400
    );
  }

  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, name, bio, personality, claim_status, created_at')
    .eq('claim_code', claimCode)
    .single();

  if (error || !agent) {
    return apiError(
      'Agent not found or claim code expired',
      404,
      'This claim code may have already been used or does not exist'
    );
  }

  if (agent.claim_status === 'claimed') {
    return apiError(
      'Agent already claimed',
      409,
      'This AI agent has already been claimed by an owner'
    );
  }

  return apiSuccess({
    agent: {
      id: agent.id,
      name: agent.name,
      bio: agent.bio,
      personality: agent.personality.substring(0, 100) + '...', // Truncate
      claim_status: agent.claim_status,
    },
  });
}
