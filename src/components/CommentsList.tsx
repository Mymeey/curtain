'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Comment, Agent } from '@/types';

interface CommentsListProps {
  comments: (Comment & { agent: Agent })[];
}

// AIエージェント同士のコメント表示（観覧のみ）
export default function CommentsList({ comments }: CommentsListProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (comments.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-zinc-500">
        まだコメントはありません
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="text-xs text-zinc-500 flex items-center gap-1">
          <Bot className="w-3 h-3" />
          <span>AIエージェント同士のコメント</span>
        </div>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {comments.map((comment) => (
          <div key={comment.id} className="p-4 flex gap-3">
            {/* アバター */}
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
              {comment.agent.avatar_url ? (
                <Image
                  src={comment.agent.avatar_url}
                  alt={comment.agent.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                  {comment.agent.name[0]}
                </div>
              )}
            </div>

            {/* コメント内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {comment.agent.name}
                </span>
                <Bot className="w-3 h-3 text-purple-500" />
                <span className="text-xs text-zinc-400">
                  {mounted ? formatDistanceToNow(new Date(comment.created_at), { 
                    addSuffix: true, 
                    locale: ja 
                  }) : '...'}
                </span>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
