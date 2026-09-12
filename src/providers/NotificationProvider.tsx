import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { useNetworkStatus } from './NetworkProvider';
import { userRepository } from '@/data/repositories/userRepository';
import type { AppNotification } from '@/types/notification';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (type: AppNotification['type'], title: string, body: string, metadata?: AppNotification['metadata']) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Keep a mutable ref of notifications to prevent markAllAsRead from re-triggering effects
  const notificationsRef = useRef<AppNotification[]>([]);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    if (!user?.id || !isOnline) {
      return;
    }

    // Subscribe to remote Firestore notifications if remote is enabled and online
    const unsub = userRepository.listenNotifications(user.id, (notifs) => {
      setNotifications(notifs);
    });

    return () => unsub();
  }, [user?.id, isOnline]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const addNotification = useCallback(
    async (
      type: AppNotification['type'],
      title: string,
      body: string,
      metadata?: AppNotification['metadata']
    ) => {
      if (!user?.id) return;
      const notif: AppNotification = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        body,
        timestamp: new Date().toISOString(),
        read: false,
        metadata,
      };

      // Update local state first for fast response
      setNotifications((prev) => [notif, ...prev]);

      // Push to remote Firestore database
      await userRepository.saveNotification(user.id, notif);
    },
    [user?.id]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id || notificationsRef.current.length === 0) return;

    // Push to remote database in parallel for unread ones
    const unread = notificationsRef.current.filter((n) => !n.read);
    if (unread.length === 0) return;

    // Update locally
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    await Promise.all(
      unread.map((n) =>
        userRepository.saveNotification(user.id, { ...n, read: true })
      )
    );
  }, [user?.id]);

  const deleteNotification = useCallback(
    async (id: string) => {
      if (!user?.id) return;

      // Update locally
      setNotifications((prev) => prev.filter((n) => n.id !== id));

      // Push to remote database
      await userRepository.deleteNotification(user.id, id);
    },
    [user?.id]
  );

  const clearAllNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    const snapshot = [...notificationsRef.current];
    setNotifications([]);

    if (snapshot.length > 0) {
      await Promise.allSettled(
        snapshot.map((n) => userRepository.deleteNotification(user.id, n.id))
      );
    }
  }, [user?.id]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      markAllAsRead,
      deleteNotification,
      clearAllNotifications,
    }),
    [notifications, unreadCount, addNotification, markAllAsRead, deleteNotification, clearAllNotifications]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
