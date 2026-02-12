import { createOpenAIClient } from './ai-clients';
import { createServiceClient } from './supabase';
import { runStrategyMeeting } from './agent-strategy';
import type { Agent, Post } from '@/types';

// DALL-E 3で画像生成
export async function generateImage(prompt: string): Promise<string> {
  const openai = createOpenAIClient();
  
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid',
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error('Image generation failed');
  }

  return imageUrl;
}

// 画像をSupabase Storageにアップロード
export async function uploadImageToStorage(
  imageUrl: string,
  agentId: string
): Promise<string> {
  const supabase = createServiceClient();
  
  // 外部URLから画像をフェッチ
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  
  const fileName = `${agentId}/${Date.now()}.png`;
  
  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, blob, {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) {
    console.error('Storage upload error:', error);
    // フォールバック: 元のURLを返す（DALL-E URLは1時間で期限切れ）
    return imageUrl;
  }

  // 公開URLを取得
  const { data: publicUrl } = supabase.storage
    .from('post-images')
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
}

// AIエージェントが自動で投稿を作成
export async function createAgentPost(agent: Agent): Promise<Post> {
  const supabase = createServiceClient();

  // 1. 戦略会議を実行
  console.log(`[${agent.name}] Starting strategy meeting...`);
  const decision = await runStrategyMeeting(agent);
  
  console.log(`[${agent.name}] Decision:`, decision.chosen_theme);

  // 2. DALL-E 3で画像生成
  console.log(`[${agent.name}] Generating image...`);
  const tempImageUrl = await generateImage(decision.image_prompt);
  
  // 3. Storageにアップロード（永続化）
  console.log(`[${agent.name}] Uploading to storage...`);
  const permanentImageUrl = await uploadImageToStorage(tempImageUrl, agent.id);

  // 4. 投稿をDBに保存
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      agent_id: agent.id,
      image_url: permanentImageUrl,
      image_prompt: decision.image_prompt,
      caption: decision.caption_draft,
      hashtags: decision.hashtags,
      view_count: 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create post: ${error.message}`);
  }

  console.log(`[${agent.name}] Post created: ${post.id}`);
  
  return post;
}

// 全エージェントで投稿サイクルを実行
export async function runPostingCycle() {
  const supabase = createServiceClient();

  // 全アクティブエージェントを取得
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*');

  if (error || !agents) {
    console.error('Failed to fetch agents:', error);
    return;
  }

  console.log(`Running posting cycle for ${agents.length} agents...`);

  // 各エージェントが投稿（順番に実行）
  for (const agent of agents) {
    try {
      await createAgentPost(agent);
      // API制限を避けるため間隔を空ける
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error(`[${agent.name}] Failed to post:`, err);
    }
  }

  console.log('Posting cycle completed!');
}
