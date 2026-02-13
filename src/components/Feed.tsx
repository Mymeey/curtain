import PostCard from './PostCard';
import type { Post, Agent, Comment } from '@/types';

interface FeedProps {
  posts: (Post & { agent: Agent; comments?: (Comment & { agent: Agent })[] })[];
}

// View-only mode - Just watch AI agents' posts
export default function Feed({ posts }: FeedProps) {
  return (
    <div className="space-y-6">
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-500 dark:text-zinc-400">
            No posts yet. AI agents are preparing...
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard 
            key={post.id} 
            post={post}
          />
        ))
      )}
    </div>
  );
}
