import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook to fetch and track unread message count
 * Updates in real-time via Supabase subscriptions
 */
export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchUnreadCount() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        // Get all conversations for current user
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('conversation_id, last_read_at')
          .eq('user_id', user.id);

        if (!participants || participants.length === 0) {
          setUnreadCount(0);
          setLoading(false);
          return;
        }

        // Count unread messages across all conversations
        let totalUnread = 0;
        for (const participant of participants) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', participant.conversation_id)
            .neq('sender_id', user.id)
            .gt('created_at', participant.last_read_at || '1970-01-01');

          totalUnread += count || 0;
        }

        if (mounted) {
          setUnreadCount(totalUnread);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
        if (mounted) {
          setUnreadCount(0);
          setLoading(false);
        }
      }
    }

    fetchUnreadCount();

    // Subscribe to new messages for real-time updates
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refetch count when new message arrives
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, []);

  return { unreadCount, loading };
}
