export interface AppNotification {
  id: string;
  type: 'household' | 'payment' | 'streak' | 'system' | 'nudge' | 'campaign';
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  metadata?: {
    taskId?: string;
    householdId?: string;
    amount?: number;
    memberCode?: string;
    fromUserId?: string;
    fromUserName?: string;
    campaignId?: string;
    redirectUrl?: string;
    promoCode?: string;
    imageUrl?: string;
    buttonText?: string;
  };
}

