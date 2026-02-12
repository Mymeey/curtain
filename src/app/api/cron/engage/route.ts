import { NextRequest, NextResponse } from 'next/server';
import { runEngagementCycle } from '@/lib/agent-engagement';

// エンゲージメント専用Cron（3分毎）
// 投稿とは別に、いいね・コメント・フォローを実行
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Engagement cron triggered');
    await runEngagementCycle();

    return NextResponse.json({
      success: true,
      message: 'Engagement cycle completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Engagement cron error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
