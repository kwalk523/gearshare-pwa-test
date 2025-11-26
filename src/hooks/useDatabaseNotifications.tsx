import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface DatabaseNotification {
  id: string;
  user_id: string;
  type: 'message' | 'rental_request' | 'rental_accepted' | 'rental_completed' | 'review_received' | 'favorite_added' | 'gear_available';
  title: string;
  message: string;
  link: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Hook to manage database-backed notifications with real-time updates
 */
export function useDatabaseNotifications() {
  const [notifications, setNotifications] = useState<DatabaseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  // Track hard-deleted notifications locally to ignore any stale realtime echo
  // Persist ignored (dismissed) notification IDs in localStorage
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('dismissedNotificationIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  useEffect(() => {
    // Sync ignoredIds from localStorage on mount and when storage changes (multi-tab)
    const syncIgnoredIds = () => {
      const stored = localStorage.getItem('dismissedNotificationIds');
      setIgnoredIds(stored ? new Set(JSON.parse(stored)) : new Set());
    };
    syncIgnoredIds();
    window.addEventListener('storage', syncIgnoredIds);

    loadNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const evt = (payload as any).eventType as string | undefined;
          // Ignore updates that are just read status changes (we already handle locally)
          if (evt === 'UPDATE') {
            const updated = payload.new as any;
            if (updated?.id) {
              setNotifications(prev => prev.map(n => n.id === updated.id ? { ...n, is_read: updated.is_read } : n));
              // Recompute unread count efficiently
              setUnreadCount(prev => updated.is_read ? Math.max(0, prev - 1) : prev);
            }
            return;
          }
          if (evt === 'INSERT' || evt === 'DELETE') {
            // Reload to capture new or removed notifications (filter out ignored IDs)
            loadNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      window.removeEventListener('storage', syncIgnoredIds);
    };
  }, []);

  // Helper to persist ignoredIds to localStorage
  const persistIgnoredIds = (ids: Set<string>) => {
    localStorage.setItem('dismissedNotificationIds', JSON.stringify(Array.from(ids)));
  };

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const filtered = (data || []).filter(n => !ignoredIds.has(n.id));
      setNotifications(filtered);
      setUnreadCount(filtered.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      setIgnoredIds(prev => {
        const updated = new Set([...prev, notificationId]);
        persistIgnoredIds(updated);
        return updated;
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Adjust unread count if the deleted notification was unread
      const wasUnread = notifications.find(n => n.id === notificationId && !n.is_read);
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: loadNotifications
  };
}
