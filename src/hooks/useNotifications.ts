import { useState, useEffect, useCallback, useRef } from 'react';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useAuth } from './useAuth';
import { useUserSession } from './useUserSession';

export type NotificationType = 'message' | 'invite' | 'intent';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  groupId?: string;
  senderId?: string;
  read: boolean;
  createdAt: string; // ISO string
}

const NOTIFICATIONS_API = '/.netlify/functions/notifications';
const LONGPOLL_API = '/.netlify/functions/notifications-long-poll';

export const notificationsStore = atom<Notification[]>([]);
export const unreadCountsStore = atom<Record<string, Record<string, number>>>({});

export function addNotification(notification: Notification) {
  const current = notificationsStore.get();
  if (!current.some(n => n.id === notification.id)) {
    notificationsStore.set([notification, ...current]);
  }
}

export function markAsReadInStore(notificationId: string) {
  notificationsStore.set(
    notificationsStore.get().map(n => n.id === notificationId ? { ...n, read: true } : n)
  );
}

export function markAllAsReadInStore() {
  notificationsStore.set(
    notificationsStore.get().map(n => ({ ...n, read: true }))
  );
}

export function updateUnreadCounts(counts: Record<string, Record<string, number>>) {
  unreadCountsStore.set(counts);
}

export default function useNotifications() {
  const notifications = useStore(notificationsStore);
  const unreadCounts = useStore(unreadCountsStore);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user: authUser } = useAuth();
  const { currentUser } = useUserSession();
  const displayUser = authUser || currentUser;
  const isPolling = useRef(true);
  const abortController = useRef<AbortController | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Fetch all notifications once
  const fetchNotifications = useCallback(async () => {
    if (!displayUser?.id) return;
    setLoading(true);
    try {
      const response = await fetch(NOTIFICATIONS_API, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        notificationsStore.set(data.notifications || []);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [displayUser?.id]);

  // Fetch unread counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!displayUser?.id) return;
    try {
      const response = await fetch(`${NOTIFICATIONS_API}?counts=true`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        updateUnreadCounts(data.counts || {});
      }
    } catch {}
  }, [displayUser?.id]);

  // Long-polling logic
  const poll = useCallback(async () => {
    if (!displayUser?.id || !isPolling.current) return;
    abortController.current = new AbortController();
    try {
      const response = await fetch(LONGPOLL_API, {
        method: 'GET',
        signal: abortController.current.signal,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.status === 200) {
        const data: Notification[] = await response.json();
        // Merge new notifications
        const current = notificationsStore.get();
        const newIds = new Set(current.map(n => n.id));
        const merged = [...data.filter(n => !newIds.has(n.id)), ...current];
        notificationsStore.set(merged);
        fetchUnreadCounts();
        // Immediately poll again
        if (isPolling.current) poll();
      } else if (response.status === 204) {
        // No new notifications, poll again
        if (isPolling.current) poll();
      } else {
        // Error, wait and retry
        setTimeout(() => { if (isPolling.current) poll(); }, 5000);
      }
    } catch (err) {
      if ((err as any).name !== 'AbortError') {
        setError(err as Error);
        setTimeout(() => { if (isPolling.current) poll(); }, 5000);
      }
    }
  }, [displayUser?.id, fetchUnreadCounts]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!displayUser?.id) return;
    try {
      const response = await fetch(NOTIFICATIONS_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId })
      });
      if (response.ok) {
        markAsReadInStore(notificationId);
        fetchUnreadCounts();
      }
    } catch {}
  }, [displayUser?.id, fetchUnreadCounts]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!displayUser?.id) return;
    try {
      const response = await fetch(NOTIFICATIONS_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' })
      });
      if (response.ok) {
        markAllAsReadInStore();
        fetchUnreadCounts();
      }
    } catch {}
  }, [displayUser?.id, fetchUnreadCounts]);

  // Mark group as read
  const markGroupAsRead = useCallback(async (groupId: string, type?: NotificationType) => {
    if (!displayUser?.id || !groupId) return;
    try {
      const response = await fetch(NOTIFICATIONS_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_group_read', group_id: groupId, type })
      });
      if (response.ok) {
        const current = notificationsStore.get();
        notificationsStore.set(
          current.map(n => (n.groupId === groupId && (!type || n.type === type)) ? { ...n, read: true } : n)
        );
        fetchUnreadCounts();
      }
    } catch {}
  }, [displayUser?.id, fetchUnreadCounts]);

  // Create notification
  const createNotification = useCallback(async (
    type: NotificationType,
    title: string,
    message: string,
    groupId?: string,
    targetUserId?: string
  ) => {
    if (!displayUser?.id) return;
    try {
      const response = await fetch(NOTIFICATIONS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, message, group_id: groupId, target_user_id: targetUserId })
      });
      if (response.ok) {
        const data = await response.json();
        if (!targetUserId || targetUserId === displayUser.id) {
          addNotification(data.notification);
          fetchUnreadCounts();
        }
        return data.notification;
      }
    } catch {
      return null;
    }
  }, [displayUser?.id, fetchUnreadCounts]);

  // Start polling on mount
  useEffect(() => {
    if (!displayUser?.id) return;
    isPolling.current = true;
    fetchNotifications();
    fetchUnreadCounts();
    poll();
    return () => {
      isPolling.current = false;
      if (abortController.current) abortController.current.abort();
    };
  }, [displayUser?.id, fetchNotifications, fetchUnreadCounts, poll]);

  const getUnreadCountForGroup = useCallback((groupId: string, type?: NotificationType) => {
    if (!groupId || !unreadCounts[groupId]) return 0;
    if (type) return unreadCounts[groupId][type] || 0;
    return Object.values(unreadCounts[groupId]).reduce((acc, count) => acc + count, 0);
  }, [unreadCounts]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    markGroupAsRead,
    createNotification,
    getUnreadCountForGroup,
    fetchNotifications,
    fetchUnreadCounts
  };
}
