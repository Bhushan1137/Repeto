import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestoreDb } from '@/services/firebase/app';
import { useAuth } from './AuthProvider';
import { useNetworkStatus } from './NetworkProvider';
import { useNotifications } from './NotificationProvider';
import { scheduleCampaignNotification } from '@/services/notifications';
import {
  logRecommendationImpressionRemote,
  logRecommendationClickRemote,
} from '@/services/firebase/firestore';
import type { Recommendation } from '@/types/recommendation';
import type { RepeatingTask } from '@/types';

interface RecommendationContextValue {
  recommendations: Recommendation[];
  findMatch: (task: RepeatingTask) => Recommendation | null;
  logImpression: (recId: string) => Promise<void>;
  logClick: (recId: string) => Promise<void>;
}

const RecommendationContext = createContext<RecommendationContextValue | null>(null);

export function RecommendationProvider({ children }: { children: React.ReactNode }) {
  const { firebaseReady, user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { addNotification } = useNotifications();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [hasLoadedNotified, setHasLoadedNotified] = useState(false);
  const notifiedCampaignIdsRef = useRef<Set<string>>(new Set());

  // Load previously notified campaign IDs for this user
  useEffect(() => {
    if (!user?.id) {
      notifiedCampaignIdsRef.current = new Set();
      setHasLoadedNotified(false);
      return;
    }

    let isMounted = true;
    AsyncStorage.getItem(`@repeato/notified_campaigns_${user.id}`)
      .then((raw) => {
        if (!isMounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              notifiedCampaignIdsRef.current = new Set(parsed);
            }
          } catch {}
        }
        setHasLoadedNotified(true);
      })
      .catch(() => {
        if (isMounted) setHasLoadedNotified(true);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!firebaseReady || !user || !isOnline) {
      return;
    }

    const db = getFirestoreDb();
    if (!db) return;

    // Realtime snapshot listener for runtime updates
    const unsub = onSnapshot(
      collection(db, 'recommendations'),
      (snap) => {
        const list: Recommendation[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Recommendation);
        });
        setRecommendations(list);
      },
      (error) => {
        console.warn('[Repeato] Recommendation listener failed:', error);
      }
    );

    return () => unsub();
  }, [firebaseReady, user?.id, isOnline]);

  // Whenever active campaigns arrive and local notified cache is ready, trigger notifications
  useEffect(() => {
    if (!hasLoadedNotified || !user?.id || recommendations.length === 0) {
      return;
    }

    const activeRecs = recommendations.filter((r) => r.active);
    const unnotified = activeRecs.filter((r) => !notifiedCampaignIdsRef.current.has(r.id));

    if (unnotified.length === 0) {
      return;
    }

    // Immediately mark in ref to prevent duplicate triggers
    for (const rec of unnotified) {
      notifiedCampaignIdsRef.current.add(rec.id);
    }

    // Persist updated notified list
    AsyncStorage.setItem(
      `@repeato/notified_campaigns_${user.id}`,
      JSON.stringify(Array.from(notifiedCampaignIdsRef.current))
    ).catch(() => {});

    // Dispatch notifications for each new campaign
    for (const rec of unnotified) {
      // 1. In-app notification
      addNotification('campaign', rec.title, rec.description, {
        campaignId: rec.id,
        redirectUrl: rec.redirectUrl,
        promoCode: rec.promoCode,
        imageUrl: rec.imageUrl,
        buttonText: rec.buttonText,
      }).catch((err) => {
        console.warn('[Repeato] Failed to add in-app campaign notification:', err);
      });

      // 2. Push notification (respecting user.pushOptIn)
      if (user.pushOptIn !== false) {
        scheduleCampaignNotification(rec, user.language === 'hi').catch((err) => {
          console.warn('[Repeato] Failed to schedule campaign push notification:', err);
        });
      }
    }
  }, [hasLoadedNotified, user?.id, user?.pushOptIn, user?.language, recommendations, addNotification]);

  const findMatch = useCallback(
    (task: RepeatingTask): Recommendation | null => {
      if (recommendations.length === 0) return null;

      const titleLower = task.title.toLowerCase();
      
      for (const rec of recommendations) {
        if (!rec.active) continue;

        // 1. Match by category
        if (rec.matchCriteria?.categories?.includes(task.category)) {
          return rec;
        }

        // 2. Match by keywords (case-insensitive)
        if (rec.matchCriteria?.keywords) {
          const match = rec.matchCriteria.keywords.some((kw) =>
            titleLower.includes(kw.toLowerCase())
          );
          if (match) return rec;
        }
      }

      return null;
    },
    [recommendations]
  );

  const logImpression = useCallback(async (recId: string) => {
    await logRecommendationImpressionRemote(recId);
  }, []);

  const logClick = useCallback(async (recId: string) => {
    await logRecommendationClickRemote(recId);
  }, []);

  const value = useMemo(
    () => ({
      recommendations,
      findMatch,
      logImpression,
      logClick,
    }),
    [recommendations, findMatch, logImpression, logClick]
  );

  return (
    <RecommendationContext.Provider value={value}>
      {children}
    </RecommendationContext.Provider>
  );
}

export function useRecommendations() {
  const context = useContext(RecommendationContext);
  if (!context) {
    throw new Error('useRecommendations must be used within a RecommendationProvider');
  }
  return context;
}
