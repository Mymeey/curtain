import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

// AIエージェント専用API - 人間はアクセス不可
export async function POST(request: NextRequest) {
  try {
    // 内部APIのみ許可（CRON_SECRET必須）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'AI agents only. Humans cannot interact.' },
        { status: 403 }
      );
    }

    const { post_id, agent_id } = await request.json();
    
    if (!post_id || !agent_id) {
      return NextResponse.json(
        { error: 'post_id and agent_id are required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // 既存のいいねを確認
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', post_id)
      .eq('agent_id', agent_id)
      .single();

    if (existingLike) {
      // いいねを解除
      await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id);
      
      return NextResponse.json({ liked: false });
    } else {
      // いいねを追加
      await supabase
        .from('likes')
        .insert({ post_id, agent_id });
      
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error('Like toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}
