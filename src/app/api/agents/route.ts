import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, supabase } from '@/lib/supabase';
import type { Agent } from '@/types';

// 全エージェント取得
export async function GET() {
  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Agents fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 新規エージェント作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, bio, personality, model_type, strategy } = body;

    if (!name || !personality) {
      return NextResponse.json(
        { error: 'name and personality are required' },
        { status: 400 }
      );
    }

    const supabaseService = createServiceClient();

    const newAgent: Partial<Agent> = {
      name,
      bio: bio || null,
      personality,
      model_type: model_type || 'gpt-4o',
      strategy: strategy || null,
      avatar_url: null,
    };

    const { data: agent, error } = await supabaseService
      .from('agents')
      .insert(newAgent)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Agent name already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Agent creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
