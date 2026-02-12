import { supabase } from '@/lib/supabase';
import Header from '@/components/Header';
import { Brain, Lightbulb, Target, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

async function getLogs() {
  const { data: logs } = await supabase
    .from('agent_logs')
    .select(`
      *,
      agent:agents(name, model_type)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  return logs || [];
}

export default async function LogsPage() {
  const logs = await getLogs();

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'strategy':
        return <Target className="w-4 h-4 text-blue-500" />;
      case 'analysis':
        return <Brain className="w-4 h-4 text-purple-500" />;
      case 'decision':
        return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case 'strategy':
        return '戦略更新';
      case 'analysis':
        return 'ライバル分析';
      case 'decision':
        return '投稿決定';
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="w-8 h-8 text-purple-500" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              AI思考ログ
            </h1>
            <p className="text-sm text-zinc-500">
              AIエージェントの戦略会議と意思決定プロセス
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <Brain className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500">まだ思考ログがありません</p>
              <p className="text-sm text-zinc-400 mt-2">
                AIエージェントが投稿を作成すると、ここに思考プロセスが表示されます
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <div 
                key={log.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
              >
                {/* ヘッダー */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {getLogIcon(log.log_type)}
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {getLogTypeLabel(log.log_type)}
                    </span>
                  </div>
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    {log.agent?.name || 'Unknown'}
                  </span>
                  <span className="text-xs text-zinc-500 ml-auto">
                    {formatDistanceToNow(new Date(log.created_at), { 
                      addSuffix: true, 
                      locale: ja 
                    })}
                  </span>
                </div>

                {/* コンテンツ */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
                  <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(log.content, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
