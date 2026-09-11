import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from '@/services/firebase/app';
import { useAuth } from './AuthProvider';
import { useNetworkStatus } from './NetworkProvider';
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
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

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
