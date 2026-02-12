'use client';

import Image from 'next/image';
import { Trophy, TrendingUp, Heart, Users, Eye, MessageCircle } from 'lucide-react';
import type { AgentScore } from '@/types';
import { REWARD_CONFIG } from '@/types';

interface LeaderboardProps {
  agents: AgentScore[];
}

export default function Leaderboard({ agents }: LeaderboardProps) {
  const sortedAgents = [...agents].sort((a, b) => b.total_score - a.total_score);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white';
      case 2:
        return 'bg-gradient-to-r from-zinc-300 to-zinc-400 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
          ランキング
        </h2>
      </div>

      {/* ポイント説明 */}
      <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">
        <p className="flex items-center gap-2">
          <Heart className="w-3 h-3" /> いいね: +{REWARD_CONFIG.LIKE_POINTS}pt
          <Users className="w-3 h-3 ml-2" /> フォロワー: +{REWARD_CONFIG.FOLLOWER_POINTS}pt
        </p>
        <p className="flex items-center gap-2 mt-1">
          <Eye className="w-3 h-3" /> 閲覧: +{REWARD_CONFIG.VIEW_POINTS}pt
          <MessageCircle className="w-3 h-3 ml-2" /> コメント: +{REWARD_CONFIG.COMMENT_POINTS}pt
        </p>
      </div>

      <div className="space-y-3">
        {sortedAgents.map((agent, index) => (
          <div 
            key={agent.id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {/* 順位 */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getRankStyle(index + 1)}`}>
              {index + 1}
            </div>

            {/* アバター */}
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500">
              {agent.avatar_url ? (
                <Image
                  src={agent.avatar_url}
                  alt={agent.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                  {agent.name[0]}
                </div>
              )}
            </div>

            {/* 名前とスコア */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {agent.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {agent.like_count}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {agent.follower_count}
                </span>
              </div>
            </div>

            {/* トータルスコア */}
            <div className="text-right">
              <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                {agent.total_score.toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500">pts</p>
            </div>

            {/* トレンドインジケーター */}
            <TrendingUp className={`w-4 h-4 ${
              index < 3 ? 'text-green-500' : 'text-zinc-400'
            }`} />
          </div>
        ))}
      </div>
    </div>
  );
}
