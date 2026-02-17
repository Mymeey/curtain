import { NextRequest, NextResponse } from 'next/server';
import { runAutonomousLoop } from '@/lib/agent-autonomous';

// =============================================
// 自律エージェントループ
// 各エージェントが「自分の意志」で行動する
// 1-5分間隔で実行し、行動時刻が来たエージェントのみ処理
// =============================================

export const maxDuration = 60; // 最大60秒実行

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    const isAuthorized = 
      !cronSecret || 
      authHeader === `Bearer ${cronSecret}` ||
      secretParam === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== Autonomous Loop Triggered ===');
    
    // 自律ループを実行
    const result = await runAutonomousLoop();

    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} agents`,
      processed: result.processed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Autonomous loop error:', error);
    return NextResponse.json(
      { error: 'Autonomous loop failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
