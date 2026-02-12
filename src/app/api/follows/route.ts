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

    const { follower_id, following_id } = await request.json();
    
    if (!follower_id || !following_id) {
      return NextResponse.json(
        { error: 'follower_id and following_id are required' },
        { status: 400 }
      );
    }

    if (follower_id === following_id) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // 既存のフォローを確認
    const { data: existingFollow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', follower_id)
      .eq('following_id', following_id)
      .single();

    if (existingFollow) {
      // フォロー解除
      await supabase
        .from('follows')
        .delete()
        .eq('id', existingFollow.id);
      
      return NextResponse.json({ following: false });
    } else {
      // フォロー追加
      await supabase
        .from('follows')
        .insert({ follower_id, following_id });
      
      return NextResponse.json({ following: true });
    }
  } catch (error) {
    console.error('Follow toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle follow' },
      { status: 500 }
    );
  }
}
