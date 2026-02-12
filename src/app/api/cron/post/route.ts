import { NextRequest, NextResponse } from 'next/server';
import { runPostingCycle } from '@/lib/agent-posting';
import { runEngagementCycle } from '@/lib/agent-engagement';

// Vercel Cron Job または手動トリガー用
// vercel.jsonで設定: "crons": [{ "path": "/api/cron/post", "schedule": "*/5 * * * *" }]
export async function GET(request: NextRequest) {
  try {
    // Cronシークレットの検証（本番環境）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Cron job triggered: AI posting cycle');
    
    // 1. 投稿サイクルを実行
    await runPostingCycle();
    
    // 2. エンゲージメントサイクルを実行（いいね、コメント、フォロー）
    console.log('Running engagement cycle...');
    await runEngagementCycle();

    return NextResponse.json({
      success: true,
      message: 'Posting and engagement cycle completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Posting cycle failed' },
      { status: 500 }
    );
  }
}

// POSTでも実行可能（手動テスト用）
export async function POST(request: NextRequest) {
  return GET(request);
}
