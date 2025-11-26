import { createContext, useContext, useState, ReactNode } from 'react';

export type AppNotificationType = 'info' | 'success' | 'warning';
export interface AppNotification {
  id: string;
  text: string;
  type: AppNotificationType;
  read: boolean;
  timestamp: number;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  push: (text: string, type?: AppNotificationType) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const push = (text: string, type: AppNotificationType = 'info') => {
    let id: string;
    try {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? (crypto as { randomUUID: () => string }).randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    } catch {
      id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    setNotifications(prev => [...prev, { id, text, type, read: false, timestamp: Date.now() }]);
  };

  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, push, markRead, markAllRead, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

// moved dispatch hook to useNotificationHooks.ts to reduce exports here