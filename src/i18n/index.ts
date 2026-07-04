import { en, type TranslationKey } from './en';
import { hi } from './hi';
import type { Language } from '@/types';

const dictionaries = { en, hi };

export function t(lang: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  let text = dictionaries[lang][key] ?? en[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

export { en, hi };
export type { TranslationKey };
