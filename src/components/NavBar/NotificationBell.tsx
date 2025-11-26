'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDatabaseNotifications } from '../../hooks/useDatabaseNotifications';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useDatabaseNotifications();
  const [dropdown, setDropdown] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdown && bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setDropdown(false);
      }
    }
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [dropdown]);

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'rental_accepted':
      case 'rental_completed':
      case 'favorite_added':
        return 'bg-emerald-500';
      case 'rental_request':
      case 'review_received':
        return 'bg-indigo-500';
      case 'message':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markAsRead(notification.id);
    setDropdown(false);
    // Force lender context for rental requests so owner can act
    if (notification.type === 'rental_request') {
      navigate('/lend?tab=rentals&status=pending');
      return;
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setDropdown(d => !d)}
        className="p-2 rounded-full hover:bg-indigo-100 relative"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-indigo-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>
      {dropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 animate-fade-in max-h-[500px] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
            <span className="font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 text-sm border-b last:border-b-0 transition cursor-pointer hover:bg-indigo-50 ${
                  n.is_read ? 'text-gray-500 bg-gray-50' : 'font-semibold text-gray-800 bg-white'
                }`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${getNotificationColor(n.type)}`}></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 mb-1">{n.title}</p>
                    <p className={n.is_read ? 'text-gray-500' : 'text-gray-700'}>{n.message}</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(n.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0"
                    aria-label="Delete notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}