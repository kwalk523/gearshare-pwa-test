'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Send, ArrowLeft, MoreVertical, Search, MessageCircle } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_deleted: boolean;
  is_flagged: boolean;
  created_at: string;
  sender?: Profile;
}

interface Conversation {
  id: string;
  is_direct: boolean;
  created_at: string;
  last_message_at?: string;
  gear_listing_id?: string;
  // Populated from conversation_participants
  other_participant?: Profile;
  last_message?: string;
  unread_count?: number;
}

interface MessagingProps {
  currentUserId: string;
  initialConversationId?: string;
}

export default function Messaging({ currentUserId, initialConversationId }: MessagingProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Effects (placed after callback declarations to avoid temporal dead zone issues)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);

      // Get user's conversation participants
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', currentUserId);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map(p => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      // For each conversation, get other participant and last message
      const enrichedConversations = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          // Get other participant
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('profile_id, profiles(id, full_name, avatar_url)')
            .eq('conversation_id', conv.id)
            .neq('profile_id', currentUserId);

          const otherParticipant = participants?.[0]?.profiles as unknown as Profile;

          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { data: participantInfo } = await supabase
            .from('conversation_participants')
            .select('last_read_at')
            .eq('conversation_id', conv.id)
            .eq('profile_id', currentUserId)
            .single();

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', currentUserId)
            .gt('created_at', participantInfo?.last_read_at || '1970-01-01');

          return {
            ...conv,
            other_participant: otherParticipant,
            last_message: lastMsg?.content,
            unread_count: unreadCount || 0
          };
        })
      );

      setConversations(enrichedConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const loadConversationById = useCallback(async (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedConversation(conversation);
    }
  }, [conversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:sender_id(id, full_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      type RawMessage = Message & { profiles: Profile };
      const transformedMessages: Message[] = (data as RawMessage[] | null)?.map((msg) => ({
        ...msg,
        sender: msg.profiles
      })) ?? [];

      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []);

  const markMessagesAsRead = useCallback(async (conversationId: string) => {
    try {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('profile_id', currentUserId);

      // Update local unread count
      setConversations(convs =>
        convs.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [currentUserId]);

  const handleNewMessage = useCallback((newMessage: Message) => {
    // If it's for the current conversation, add it
    if (selectedConversation && newMessage.conversation_id === selectedConversation.id) {
      setMessages(prev => [...prev, newMessage]);
      
      // Mark as read if it's not from current user
      if (newMessage.sender_id !== currentUserId) {
        markMessagesAsRead(selectedConversation.id);
      }
    }

    // Update conversation list
    loadConversations();
  }, [selectedConversation, currentUserId, markMessagesAsRead, loadConversations]);

  // Conversation/channel subscription
  useEffect(() => {
    loadConversations();
    const channel = supabase
      .channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        handleNewMessage(payload.new as Message);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, loadConversations, handleNewMessage]);

  // Load specific initial conversation if provided
  useEffect(() => {
    if (initialConversationId) loadConversationById(initialConversationId);
  }, [initialConversationId, loadConversationById]);

  // Load messages & mark as read when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      markMessagesAsRead(selectedConversation.id);
    }
  }, [selectedConversation, markMessagesAsRead, loadMessages]);

  // Auto-scroll when messages list updates
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || sending) return;

    try {
      setSending(true);

      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          content: messageText.trim()
        });

      if (error) throw error;

      setMessageText('');
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_participant?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-200px)] bg-app border border-thematic rounded-xl shadow-lg overflow-hidden">
      {/* Conversations List */}
  <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-thematic bg-surface`}>
        <div className="p-4 border-b border-thematic">
          <h2 className="mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-thematic rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-surface"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-muted">No conversations yet</p>
              <p className="text-sm text-muted mt-1">Start chatting with gear owners!</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 transition-colors border-b border-thematic hover:bg-elevated ${selectedConversation?.id === conv.id ? 'bg-emerald-600/20' : ''}`}
              >
                {conv.other_participant?.avatar_url ? (
                  <img
                    src={conv.other_participant.avatar_url}
                    alt={conv.other_participant.full_name}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 font-semibold text-lg">
                      {conv.other_participant?.full_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold truncate">{conv.other_participant?.full_name || 'Unknown User'}</span>
                    {conv.last_message_at && (
                      <span className="text-xs text-muted ml-2 flex-shrink-0">{formatMessageTime(conv.last_message_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted truncate flex-1">{conv.last_message || 'No messages yet'}</p>
                    {(conv.unread_count || 0) > 0 && (
                      <span className="bg-emerald-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">{conv.unread_count}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-surface">
          <div className="p-4 border-b border-thematic flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedConversation(null)} className="md:hidden text-muted hover:text-[var(--color-text)]">
                <ArrowLeft className="w-5 h-5" />
              </button>
              {selectedConversation.other_participant?.avatar_url ? (
                <img
                  src={selectedConversation.other_participant.avatar_url}
                  alt={selectedConversation.other_participant.full_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-emerald-600 font-semibold">
                    {selectedConversation.other_participant?.full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-semibold">{selectedConversation.other_participant?.full_name || 'Unknown User'}</h3>
              </div>
            </div>
            <button className="text-muted hover:text-[var(--color-text)]">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted">No messages yet. Start the conversation!</div>
            ) : (
              messages.map(message => {
                const isOwnMessage = message.sender_id === currentUserId;
                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-end gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isOwnMessage && (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-600 text-sm font-semibold">{message.sender?.full_name?.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div>
                        <div className={`px-4 py-2 rounded-2xl ${isOwnMessage ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-elevated text-[var(--color-text)] rounded-bl-none'}`}>
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                        <span className="text-xs text-muted mt-1 block">{formatMessageTime(message.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-thematic bg-surface">
            <div className="flex items-end gap-2">
              <textarea
                ref={messageInputRef}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 border border-thematic rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none max-h-32 bg-elevated"
                style={{ minHeight: '42px' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                className="btn btn-press bg-emerald-600 text-white p-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-muted mx-auto mb-4" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm text-muted mt-1">Choose a conversation from the list to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
}
