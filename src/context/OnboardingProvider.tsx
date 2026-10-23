import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CategoryKey, Language } from '@/types';
import { buildOnboardingSuggestions, type OnboardingSuggestion } from '@/domain/onboarding';

interface OnboardingContextValue {
  language: Language;
  name: string;
  phone: string;
  email: string;
  categories: CategoryKey[];
  suggestions: OnboardingSuggestion[];
  pushOptIn: boolean;
  setLanguage: (l: Language) => void;
  setName: (n: string) => void;
  setPhone: (p: string) => void;
  setEmail: (e: string) => void;
  toggleCategory: (c: CategoryKey) => void;
  buildSuggestions: () => void;
  toggleSuggestion: (index: number) => void;
  updateSuggestion: (index: number, patch: Partial<OnboardingSuggestion>) => void;
  setPushOptIn: (v: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [categories, setCategories] = useState<CategoryKey[]>([]);
  const [suggestions, setSuggestions] = useState<OnboardingSuggestion[]>([]);
  const [pushOptIn, setPushOptIn] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('@repeato/selected_language').then((val) => {
      if (val) {
        setLanguageState(val as Language);
      }
    });
  }, []);

  const setLanguage = async (l: Language) => {
    setLanguageState(l);
    try {
      await AsyncStorage.setItem('@repeato/selected_language', l);
    } catch (err) {
      console.warn('[Repeato] Failed to save onboarding language selection', err);
    }
  };

  const toggleCategory = (key: CategoryKey) => {
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const buildSuggestions = () => {
    setSuggestions(buildOnboardingSuggestions(categories));
  };

  const toggleSuggestion = (index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, accepted: !s.accepted } : s))
    );
  };

  const updateSuggestion = (index: number, patch: Partial<OnboardingSuggestion>) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const value = useMemo(
    () => ({
      language,
      name,
      phone,
      email,
      categories,
      suggestions,
      pushOptIn,
      setLanguage,
      setName,
      setPhone,
      setEmail,
      toggleCategory,
      buildSuggestions,
      toggleSuggestion,
      updateSuggestion,
      setPushOptIn,
    }),
    [language, name, phone, email, categories, suggestions, pushOptIn]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
