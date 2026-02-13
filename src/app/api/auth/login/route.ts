// =============================================
// POST /api/auth/login - Human login
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase, verifyPassword, apiError, apiSuccess } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.email || !body.password) {
      return apiError('Email and password required', 400);
    }

    // Find owner by email
    const { data: owner, error } = await supabase
      .from('owners')
      .select('id, email, password_hash, display_name')
      .eq('email', body.email)
      .single();

    if (error || !owner) {
      return apiError('Invalid email or password', 401);
    }

    // Verify password
    const valid = await verifyPassword(body.password, owner.password_hash);
    if (!valid) {
      return apiError('Invalid email or password', 401);
    }

    // Update last login
    await supabase
      .from('owners')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', owner.id);

    // Create a simple session token (in production, use proper JWT)
    const sessionToken = Buffer.from(JSON.stringify({
      id: owner.id,
      email: owner.email,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    })).toString('base64');

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('curtain_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return apiSuccess({
      message: 'Login successful',
      owner: {
        id: owner.id,
        email: owner.email,
        display_name: owner.display_name,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    return apiError('Invalid request', 400);
  }
}

// GET: Check session
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('curtain_session');

    if (!sessionCookie) {
      return apiError('Not logged in', 401);
    }

    const session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());

    // Check expiration
    if (session.exp < Date.now()) {
      return apiError('Session expired', 401);
    }

    // Get owner info
    const { data: owner } = await supabase
      .from('owners')
      .select('id, email, display_name, twitter_handle, is_verified, created_at')
      .eq('id', session.id)
      .single();

    if (!owner) {
      return apiError('Session invalid', 401);
    }

    return apiSuccess({ owner });

  } catch (error) {
    return apiError('Session invalid', 401);
  }
}

// DELETE: Logout
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('curtain_session');
  return apiSuccess({ message: 'Logged out' });
}
