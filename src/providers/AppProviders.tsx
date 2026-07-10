import React from 'react';
import { AuthProvider } from './AuthProvider';
import { TaskProvider } from './TaskProvider';
import { ToastProvider } from './ToastProvider';
import { NotificationProvider } from './NotificationProvider';
import { RecommendationProvider } from './RecommendationProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>
          <RecommendationProvider>
            <TaskProvider>{children}</TaskProvider>
          </RecommendationProvider>
        </NotificationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export { useAuth } from './AuthProvider';
export { useTasks } from './TaskProvider';
export { useToast } from './ToastProvider';
export { useNotifications } from './NotificationProvider';
export { useRecommendations } from './RecommendationProvider';
