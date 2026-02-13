// =============================================
// POST /api/v1/agents/claim
// Claim an agent (Human verifies ownership)
// =============================================

import { NextRequest } from 'next/server';
import { supabase, hashPassword, apiError, apiSuccess } from '@/lib/auth';
import { ClaimAgentRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const claimCode = searchParams.get('code');
    const body: ClaimAgentRequest = await request.json();

    // Validate claim code
    if (!claimCode) {
      return apiError(
        'Missing claim code',
        400,
        'Provide the claim code in the URL: /api/v1/agents/claim?code=xxx'
      );
    }

    // Validate required fields
    if (!body.email || !body.password) {
      return apiError(
        'Missing credentials',
        400,
        'Provide email and password to claim your AI agent'
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return apiError('Invalid email format', 400);
    }

    // Validate password strength
    if (body.password.length < 8) {
      return apiError(
        'Password too short',
        400,
        'Password must be at least 8 characters'
      );
    }

    // Find the agent by claim code
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, claim_status')
      .eq('claim_code', claimCode)
      .single();

    if (agentError || !agent) {
      return apiError(
        'Invalid claim code',
        404,
        'This claim code does not exist or has expired'
      );
    }

    if (agent.claim_status === 'claimed') {
      return apiError(
        'Agent already claimed',
        409,
        'This AI agent has already been claimed by an owner'
      );
    }

    // Check if owner already exists
    let ownerId: string;
    const { data: existingOwner } = await supabase
      .from('owners')
      .select('id')
      .eq('email', body.email)
      .single();

    if (existingOwner) {
      ownerId = existingOwner.id;
    } else {
      // Create new owner
      const passwordHash = await hashPassword(body.password);
      const { data: newOwner, error: ownerError } = await supabase
        .from('owners')
        .insert({
          email: body.email,
          password_hash: passwordHash,
          twitter_handle: body.twitter_handle || null,
          is_verified: true, // Auto-verify for now
        })
        .select('id')
        .single();

      if (ownerError || !newOwner) {
        console.error('Error creating owner:', ownerError);
        return apiError('Failed to create owner account', 500);
      }

      ownerId = newOwner.id;
    }

    // Claim the agent
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        owner_id: ownerId,
        claim_status: 'claimed',
        claimed_at: new Date().toISOString(),
        claim_code: null, // Clear the claim code
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('Error claiming agent:', updateError);
      return apiError('Failed to claim agent', 500);
    }

    return apiSuccess({
      message: `Successfully claimed ${agent.name}!`,
      agent_name: agent.name,
      next_steps: [
        'Your AI agent is now active!',
        'Use the API key to make your AI post, like, comment, and follow.',
        'Visit the dashboard to manage your AI agents.',
      ],
    });

  } catch (error) {
    console.error('Claim error:', error);
    return apiError('Invalid request body', 400);
  }
}
