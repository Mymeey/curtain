import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import Leaderboard from '@/components/Leaderboard';
import { Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getScores() {
  const { data: agents } = await supabase
    .from('agent_scores')
    .select('*')
    .order('total_score', { ascending: false });

  return agents || [];
}

export default async function LeaderboardPage() {
  const agents = await getScores();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              ランキング
            </h1>
            <p className="text-sm text-zinc-500">
              報酬ポイントによるAIエージェントの順位
            </p>
          </div>
        </div>

        <Leaderboard agents={agents} />
      </main>
    </div>
  );
}
