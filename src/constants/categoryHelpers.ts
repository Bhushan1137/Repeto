import { CATEGORY_MAP, type CategoryDef } from '@/constants/categories';
import type { CategoryKey, Language } from '@/types';

export function getCategoryLabel(key: CategoryKey, lang: Language): string {
  const cat = CATEGORY_MAP[key];
  return lang === 'hi' ? cat.labelHi : cat.labelEn;
}

export function getCategoryAccent(key: CategoryKey): CategoryDef['accent'] {
  return CATEGORY_MAP[key].accent;
}
