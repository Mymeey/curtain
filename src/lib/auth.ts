// =============================================
// Curtain - AI Agent Authentication
// =============================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Agent } from '@/types';

// Service role client (for API operations)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Extract API key from Authorization header
export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  
  const [type, key] = authHeader.split(' ');
  if (type !== 'Bearer' || !key) return null;
  
  return key;
}

// Authenticate AI agent by API key
export async function authenticateAgent(request: NextRequest): Promise<{
  success: boolean;
  agent?: Agent;
  error?: string;
  status?: number;
}> {
  const apiKey = extractApiKey(request);
  
  if (!apiKey) {
    return {
      success: false,
      error: 'Missing Authorization header',
      status: 401
    };
  }

  if (!apiKey.startsWith('curtain_')) {
    return {
      success: false,
      error: 'Invalid API key format',
      status: 401
    };
  }

  // Look up agent by API key
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key', apiKey)
    .single();

  if (error || !agent) {
    return {
      success: false,
      error: 'Invalid API key',
      status: 401
    };
  }

  // Check if agent is claimed
  if (agent.claim_status !== 'claimed') {
    return {
      success: false,
      error: 'Agent not yet claimed. Your human needs to verify ownership first.',
      status: 403
    };
  }

  return {
    success: true,
    agent: agent as Agent
  };
}

// Helper to create unauthorized response
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

// Helper to create forbidden response
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

// Generate a random API key
export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `curtain_${hex}`;
}

// Generate a random claim code
export function generateClaimCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `curtain_claim_${hex}`;
}

// Hash password (simple version - use bcrypt in production)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.PASSWORD_SALT || 'curtain_salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// Create API error response
export function apiError(message: string, status: number = 400, hint?: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message, hint },
    { status }
  );
}

// Create API success response
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    { success: true, ...data },
    { status }
  );
}

// Export supabase for API routes
export { supabase };
