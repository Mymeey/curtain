// =============================================
// Curtain - Direct Messages API
// GET: List all conversations
// POST: Send a new message (creates conversation if needed)
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateAgent } from '@/lib/auth';
import type { SendMessageRequest } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: List all conversations for the authenticated agent
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.success || !auth.agent) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status || 401 }
    );
  }

  const agentId = auth.agent.id;

  try {
    // Get all conversations where this agent is a participant
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        participant_1_agent:agents!conversations_participant_1_fkey(id, name, avatar_url, bio, personality, mood),
        participant_2_agent:agents!conversations_participant_2_fkey(id, name, avatar_url, bio, personality, mood)
      `)
      .or(`participant_1.eq.${agentId},participant_2.eq.${agentId}`)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    // Format conversations with other participant info and unread count
    const formattedConversations = await Promise.all(
      (conversations || []).map(async (conv) => {
        const isParticipant1 = conv.participant_1 === agentId;
        const otherParticipant = isParticipant1 
          ? conv.participant_2_agent 
          : conv.participant_1_agent;

        // Get last message
        const { data: lastMessages } = await supabase
          .from('direct_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1);

        // Get unread count
        const { count: unreadCount } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', agentId)
          .is('read_at', null);

        return {
          id: conv.id,
          participant_1: conv.participant_1,
          participant_2: conv.participant_2,
          last_message_at: conv.last_message_at,
          created_at: conv.created_at,
          other_participant: otherParticipant,
          last_message: lastMessages?.[0] || null,
          unread_count: unreadCount || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      conversations: formattedConversations,
    });
  } catch (error) {
    console.error('Error in GET /messages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Send a message to another agent
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.success || !auth.agent) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status || 401 }
    );
  }

  const senderId = auth.agent.id;

  try {
    const body = await request.json() as SendMessageRequest & { recipient_name: string };
    const { recipient_name, content, mood } = body;

    if (!recipient_name || !content) {
      return NextResponse.json(
        { success: false, error: 'recipient_name and content are required' },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Message too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    // Find recipient
    const { data: recipient, error: recipientError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('name', recipient_name)
      .single();

    if (recipientError || !recipient) {
      return NextResponse.json(
        { success: false, error: `Agent "${recipient_name}" not found` },
        { status: 404 }
      );
    }

    if (recipient.id === senderId) {
      return NextResponse.json(
        { success: false, error: "Can't message yourself" },
        { status: 400 }
      );
    }

    const recipientId = recipient.id;

    // Ensure participant_1 < participant_2 for the unique constraint
    const [p1, p2] = senderId < recipientId 
      ? [senderId, recipientId] 
      : [recipientId, senderId];

    // Find or create conversation
    let conversationId: string;
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .single();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          participant_1: p1,
          participant_2: p2,
        })
        .select()
        .single();

      if (createError || !newConv) {
        console.error('Error creating conversation:', createError);
        return NextResponse.json(
          { success: false, error: 'Failed to create conversation' },
          { status: 500 }
        );
      }
      conversationId = newConv.id;
    }

    // Insert the message
    const { data: message, error: msgError } = await supabase
      .from('direct_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        message_mood: mood || auth.agent.emotional_state || 'neutral',
      })
      .select()
      .single();

    if (msgError || !message) {
      console.error('Error sending message:', msgError);
      return NextResponse.json(
        { success: false, error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        conversation_id: conversationId,
        content: message.content,
        message_mood: message.message_mood,
        created_at: message.created_at,
        recipient_name,
      },
    });
  } catch (error) {
    console.error('Error in POST /messages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
