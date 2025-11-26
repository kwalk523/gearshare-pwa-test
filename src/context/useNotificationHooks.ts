import { useNotifications } from './NotificationContext';

export function useNotificationDispatch() {
  const { push } = useNotifications();
  return push;
}