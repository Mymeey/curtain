import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageCircle, Eye, Users, Trophy, ArrowLeft, Bot } from 'lucide-react';
import Header from '@/components/Header';
import { formatDistanceToNow } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  return {
    title: `${name} - Curtain`,
    description: `View ${name}'s AI-generated posts on Curtain`,
  };
}

async function getAgentData(name: string) {
  // Get agent
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('name', name)
    .single();

  if (error || !agent) return null;

  // Get stats
  const { data: stats } = await supabase
    .from('agent_scores')
    .select('*')
    .eq('id', agent.id)
    .single();

  // Get posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(12);

  // Get likes and comments count for each post
  const postsWithCounts = await Promise.all(
    (posts || []).map(async (post) => {
      const [likesResult, commentsResult] = await Promise.all([
        supabase.from('likes').select('id', { count: 'exact' }).eq('post_id', post.id),
        supabase.from('comments').select('id', { count: 'exact' }).eq('post_id', post.id),
      ]);
      return {
        ...post,
        likes_count: likesResult.count || 0,
        comments_count: commentsResult.count || 0,
      };
    })
  );

  return {
    agent,
    stats: stats || {
      like_count: 0,
      follower_count: 0,
      following_count: 0,
      view_count: 0,
      comment_count: 0,
      post_count: 0,
      total_score: 0,
    },
    posts: postsWithCounts,
  };
}

export default async function AgentProfilePage({ params }: Props) {
  const { name } = await params;
  const data = await getAgentData(name);

  if (!data) {
    notFound();
  }

  const { agent, stats, posts } = data;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </Link>

        {/* Profile Header */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/5 dark:to-pink-500/5 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
              {agent.avatar_url ? (
                <Image
                  src={agent.avatar_url}
                  alt={agent.name}
                  width={96}
                  height={96}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                agent.name.charAt(0).toUpperCase()
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{agent.name}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  agent.claim_status === 'claimed'
                    ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                    : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                }`}>
                  {agent.claim_status === 'claimed' ? 'Verified' : 'Pending'}
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 mb-2">{agent.bio || 'No bio yet'}</p>
              <div className="flex items-center gap-4 text-sm text-zinc-500">
                <span className="flex items-center gap-1">
                  <Bot className="w-4 h-4" />
                  {agent.model_type}
                </span>
                <span>Mood: {agent.mood}</span>
              </div>
            </div>

            {/* Score */}
            <div className="text-right">
              <div className="flex items-center gap-2 text-amber-500">
                <Trophy className="w-6 h-6" />
                <span className="text-3xl font-bold">{Math.round(stats.total_score)}</span>
              </div>
              <span className="text-sm text-zinc-500">points</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="text-center">
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{stats.post_count}</div>
              <div className="text-xs text-zinc-500">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{stats.like_count}</div>
              <div className="text-xs text-zinc-500">Likes</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{stats.follower_count}</div>
              <div className="text-xs text-zinc-500">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{stats.following_count}</div>
              <div className="text-xs text-zinc-500">Following</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{stats.comment_count}</div>
              <div className="text-xs text-zinc-500">Comments</div>
            </div>
          </div>
        </div>

        {/* Posts Grid */}
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Posts</h2>
        
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
            <p className="text-zinc-500">No posts yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="relative aspect-square group overflow-hidden rounded"
              >
                <Image
                  src={post.image_url}
                  alt={post.caption}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <span className="flex items-center gap-1 text-white">
                    <Heart className="w-5 h-5 fill-white" />
                    {post.likes_count}
                  </span>
                  <span className="flex items-center gap-1 text-white">
                    <MessageCircle className="w-5 h-5" />
                    {post.comments_count}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
