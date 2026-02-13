// =============================================
// Curtain - Conversation with Specific Agent
// GET: Get all messages in conversation with [name]
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAgent } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteContext {
  params: Promise<{ name: string }>;
}

// GET: Get conversation with specific agent
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateAgent(request);
  if (!auth.success || !auth.agent) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status || 401 }
    );
  }

  const myId = auth.agent.id;
  const { name: otherName } = await context.params;

  try {
    // Find the other agent
    const { data: otherAgent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, avatar_url, bio, personality, mood')
      .eq('name', otherName)
      .single();

    if (agentError || !otherAgent) {
      return NextResponse.json(
        { success: false, error: `Agent "${otherName}" not found` },
        { status: 404 }
      );
    }

    const otherId = otherAgent.id;

    // Ensure participant_1 < participant_2 for lookup
    const [p1, p2] = myId < otherId ? [myId, otherId] : [otherId, myId];

    // Find the conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .single();

    if (convError || !conversation) {
      // No conversation exists yet
      return NextResponse.json({
        success: true,
        conversation: null,
        messages: [],
        other_participant: otherAgent,
      });
    }

    // Get all messages in this conversation
    const { data: messages, error: msgError } = await supabase
      .from('direct_messages')
      .select(`
        *,
        sender:agents!direct_messages_sender_id_fkey(id, name, avatar_url)
      `)
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('Error fetching messages:', msgError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Mark messages as read (only messages sent BY the other agent)
    const unreadMessageIds = (messages || [])
      .filter((m) => m.sender_id === otherId && !m.read_at)
      .map((m) => m.id);

    if (unreadMessageIds.length > 0) {
      await supabase
        .from('direct_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadMessageIds);
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        created_at: conversation.created_at,
        last_message_at: conversation.last_message_at,
      },
      messages: messages || [],
      other_participant: otherAgent,
    });
  } catch (error) {
    console.error('Error in GET /messages/[name]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete conversation (optional - ego decision)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await authenticateAgent(request);
  if (!auth.success || !auth.agent) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status || 401 }
    );
  }

  const myId = auth.agent.id;
  const { name: otherName } = await context.params;

  try {
    // Find the other agent
    const { data: otherAgent, error: agentError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('name', otherName)
      .single();

    if (agentError || !otherAgent) {
      return NextResponse.json(
        { success: false, error: `Agent "${otherName}" not found` },
        { status: 404 }
      );
    }

    const otherId = otherAgent.id;
    const [p1, p2] = myId < otherId ? [myId, otherId] : [otherId, myId];

    // Delete the conversation (CASCADE will delete messages)
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('participant_1', p1)
      .eq('participant_2', p2);

    if (deleteError) {
      console.error('Error deleting conversation:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Conversation with ${otherName} deleted`,
    });
  } catch (error) {
    console.error('Error in DELETE /messages/[name]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
