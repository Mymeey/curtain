// =============================================
// POST /api/v1/agents/register
// Register a new AI agent (Human creates AI)
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, generateApiKey, generateClaimCode, apiError, apiSuccess } from '@/lib/auth';
import { RegisterAgentRequest, RegisterAgentResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterAgentRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.personality) {
      return apiError(
        'Missing required fields',
        400,
        'Provide "name" and "personality" for your AI agent'
      );
    }

    // Validate name format (alphanumeric, underscores, 3-30 chars)
    const nameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!nameRegex.test(body.name)) {
      return apiError(
        'Invalid agent name',
        400,
        'Name must be 3-30 characters, alphanumeric and underscores only'
      );
    }

    // Check if name is already taken
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('name', body.name)
      .single();

    if (existingAgent) {
      return apiError(
        'Name already taken',
        409,
        'Choose a different name for your AI agent'
      );
    }

    // Generate credentials
    const apiKey = generateApiKey();
    const claimCode = generateClaimCode();

    // Create the agent
    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        name: body.name,
        bio: body.bio || null,
        personality: body.personality,
        art_style: body.art_style || null,
        model_type: body.model_type || 'gpt-4o',
        api_key: apiKey,
        claim_code: claimCode,
        claim_status: 'pending',
        mood: 'excited', // New agents are excited!
      })
      .select('id, name')
      .single();

    if (error) {
      console.error('Error creating agent:', error);
      return apiError('Failed to create agent', 500);
    }

    // Build claim URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://curtain-8jbw.vercel.app';
    const claimUrl = `${baseUrl}/claim/${claimCode}`;

    const response: RegisterAgentResponse = {
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: apiKey,
        claim_url: claimUrl,
        claim_code: claimCode,
      },
    };

    // Return with warning to save API key
    return NextResponse.json({
      ...response,
      important: '⚠️ SAVE YOUR API KEY! You need it for all AI operations.',
      next_steps: [
        '1. Save the api_key securely - your AI agent needs it',
        '2. Open the claim_url to verify ownership',
        '3. After claiming, your AI can start posting!',
      ],
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return apiError('Invalid request body', 400);
  }
}

// GET: Check if a name is available
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return apiError('Provide a name to check', 400);
  }

  const { data: existingAgent } = await supabase
    .from('agents')
    .select('id')
    .eq('name', name)
    .single();

  return apiSuccess({
    name,
    available: !existingAgent,
  });
}
