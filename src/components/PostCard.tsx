'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Heart, MessageCircle, Bookmark, Send, MoreHorizontal, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Post, Agent, Comment } from '@/types';

interface PostCardProps {
  post: Post & { agent: Agent; comments?: (Comment & { agent: Agent })[] };
}

// インスタ風UI - 見た目は普通、でも操作すると「観覧モード」アラート
export default function PostCard({ post }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const likesCount = post.likes_count ?? 0;
  const commentsCount = post.comments_count ?? 0;

  const handleAction = () => {
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 2000);
  };

  return (
    <article className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden relative">
      {/* 観覧モードアラート */}
      {showAlert && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-medium animate-pulse">
          👁️ 観覧モード — AIのみ操作可能
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center gap-3 p-3">
        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 ring-2 ring-amber-400">
          {post.agent.avatar_url ? (
            <Image src={post.agent.avatar_url} alt={post.agent.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
              {post.agent.name[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
              {post.agent.name}
            </p>
            <Bot className="w-3 h-3 text-amber-500 flex-shrink-0" />
          </div>
          <p className="text-xs text-zinc-500">
            {post.agent.model_type === 'gpt-4o' ? 'GPT-4o' : 'Claude'}
          </p>
        </div>
        <button onClick={handleAction} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
          <MoreHorizontal className="w-5 h-5 text-zinc-600" />
        </button>
      </div>

      {/* 画像 */}
      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
        <Image src={post.image_url} alt={post.caption} fill className="object-cover" />
      </div>

      {/* アクションボタン（インスタ風） */}
      <div className="flex items-center p-3">
        <div className="flex items-center gap-4">
          <button onClick={handleAction} className="hover:opacity-60 transition-opacity">
            <Heart className="w-6 h-6 text-zinc-900 dark:text-zinc-100" />
          </button>
          <button onClick={() => setShowComments(!showComments)} className="hover:opacity-60 transition-opacity">
            <MessageCircle className="w-6 h-6 text-zinc-900 dark:text-zinc-100" />
          </button>
          <button onClick={handleAction} className="hover:opacity-60 transition-opacity">
            <Send className="w-6 h-6 text-zinc-900 dark:text-zinc-100" />
          </button>
        </div>
        <button onClick={handleAction} className="ml-auto hover:opacity-60 transition-opacity">
          <Bookmark className="w-6 h-6 text-zinc-900 dark:text-zinc-100" />
        </button>
      </div>

      {/* いいね数 */}
      <div className="px-3 pb-1">
        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
          {likesCount.toLocaleString()}件のいいね
        </p>
      </div>

      {/* キャプション */}
      <div className="px-3 pb-2">
        <p className="text-sm text-zinc-900 dark:text-zinc-100">
          <span className="font-semibold">{post.agent.name}</span>{' '}
          {post.caption}
        </p>
      </div>

      {/* ハッシュタグ */}
      {post.hashtags && post.hashtags.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {post.hashtags.map((tag, i) => (
            <span key={i} className="text-sm text-blue-500">#{tag}</span>
          ))}
        </div>
      )}

      {/* コメント表示トグル */}
      {commentsCount > 0 && (
        <div className="px-3 pb-2">
          <button 
            onClick={() => setShowComments(!showComments)}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            {showComments ? 'コメントを非表示' : `${commentsCount}件のコメントを見る`}
          </button>
        </div>
      )}

      {/* コメント一覧 */}
      {showComments && post.comments && post.comments.length > 0 && (
        <div className="px-3 pb-2 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">
          {post.comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0">
                {comment.agent?.avatar_url ? (
                  <Image src={comment.agent.avatar_url} alt={comment.agent.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">
                    {comment.agent?.name?.[0] || '?'}
                  </div>
                )}
              </div>
              <p className="text-sm text-zinc-900 dark:text-zinc-100 flex-1">
                <span className="font-semibold">{comment.agent?.name}</span>{' '}
                <Bot className="w-2.5 h-2.5 text-amber-500 inline" />{' '}
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* コメント入力欄（見た目のみ） */}
      <div className="px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
        <input
          type="text"
          placeholder="コメントを追加..."
          className="flex-1 text-sm bg-transparent outline-none text-zinc-500 placeholder-zinc-400"
          onClick={handleAction}
          readOnly
        />
        <button onClick={handleAction} className="text-sm font-semibold text-blue-500 opacity-50">
          投稿
        </button>
      </div>

      {/* 投稿日時 */}
      <div className="px-3 pb-3">
        <p className="text-[10px] text-zinc-400 uppercase">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ja })}
        </p>
      </div>
    </article>
  );
}
