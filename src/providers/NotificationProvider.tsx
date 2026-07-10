import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { userRepository } from '@/data/repositories/userRepository';
import type { AppNotification } from '@/types/notification';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (type: AppNotification['type'], title: string, body: string, metadata?: AppNotification['metadata']) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    // Subscribe to remote Firestore notifications if remote is enabled
    const unsub = userRepository.listenNotifications(user.id, (notifs) => {
      setNotifications(notifs);
    });

    return () => unsub();
  }, [user?.id]);

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
    if (!user?.id || notifications.length === 0) return;

    // Update locally
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    // Push to remote database in parallel
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        userRepository.saveNotification(user.id, { ...n, read: true })
      )
    );
  }, [user?.id, notifications]);

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

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      markAllAsRead,
      deleteNotification,
    }),
    [notifications, unreadCount, addNotification, markAllAsRead, deleteNotification]
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
