import { useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { t, type TranslationKey } from '@/i18n';
import type { Language } from '@/types';

export function useTranslation(overrideLanguage?: Language) {
  const { language: authLanguage } = useAuth();
  const language = overrideLanguage ?? authLanguage;

  const translate = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => t(language, key, params),
    [language]
  );

  return { language, translate };
}
