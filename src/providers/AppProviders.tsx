import React from 'react';
import { AuthProvider } from './AuthProvider';
import { TaskProvider } from './TaskProvider';
import { ToastProvider } from './ToastProvider';
import { NotificationProvider } from './NotificationProvider';
import { RecommendationProvider } from './RecommendationProvider';
import { NetworkProvider } from './NetworkProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NetworkProvider>
        <AuthProvider>
          <NotificationProvider>
            <RecommendationProvider>
              <TaskProvider>{children}</TaskProvider>
            </RecommendationProvider>
          </NotificationProvider>
        </AuthProvider>
      </NetworkProvider>
    </ToastProvider>
  );
}

export { useAuth } from './AuthProvider';
export { useTasks } from './TaskProvider';
export { useToast } from './ToastProvider';
export { useNotifications } from './NotificationProvider';
export { useRecommendations } from './RecommendationProvider';
export { useNetworkStatus, useNetwork } from './NetworkProvider';

