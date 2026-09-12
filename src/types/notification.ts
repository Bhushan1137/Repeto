export interface AppNotification {
  id: string;
  type: 'household' | 'payment' | 'streak' | 'system' | 'nudge';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  metadata?: {
    taskId?: string;
    amount?: number;
    memberCode?: string;
    fromUserId?: string;
    fromUserName?: string;
  };
}
