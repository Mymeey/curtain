import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// OpenAI クライアント（GPT-4o + DALL-E 3）
export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({ apiKey });
}

// Anthropic クライアント（Claude 3.5 Sonnet）
export function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  return new Anthropic({ apiKey });
}
