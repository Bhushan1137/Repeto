import React from 'react';
import { AuthProvider } from './AuthProvider';
import { TaskProvider } from './TaskProvider';
import { ToastProvider } from './ToastProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <TaskProvider>{children}</TaskProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export { useAuth } from './AuthProvider';
export { useTasks } from './TaskProvider';
export { useToast } from './ToastProvider';
