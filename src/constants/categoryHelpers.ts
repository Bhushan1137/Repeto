import { CATEGORY_MAP, type CategoryDef } from '@/constants/categories';
import type { AnyCategoryKey, CategoryKey, CustomCategoryDef, Language } from '@/types';

// In-memory cache of user-defined custom categories
const customCategoryRegistry = new Map<string, CustomCategoryDef>();

export function registerCustomCategories(categories: CustomCategoryDef[]): void {
  customCategoryRegistry.clear();
  for (const c of categories) {
    customCategoryRegistry.set(c.key, c);
  }
}

export function getCategoryDef(key: AnyCategoryKey): {
  key: string;
  labelEn: string;
  labelHi: string;
  icon: string;
  accent: 'clay' | 'teal' | 'marigold';
  group: 'money' | 'home' | 'life';
} {
  const builtIn = CATEGORY_MAP[key as CategoryKey];
  if (builtIn) return builtIn;

  const custom = customCategoryRegistry.get(key);
  if (custom) {
    return {
      key: custom.key,
      labelEn: custom.labelEn,
      labelHi: custom.labelHi || custom.labelEn,
      icon: custom.icon,
      accent: custom.accent,
      group: custom.group,
    };
  }

  // Safe fallback for unknown or deleted custom categories
  return {
    key,
    labelEn: 'General',
    labelHi: 'सामान्य',
    icon: '📋',
    accent: 'clay',
    group: 'life',
  };
}

export function getCategoryLabel(key: AnyCategoryKey, lang: Language): string {
  const cat = getCategoryDef(key);
  return lang === 'hi' ? cat.labelHi : cat.labelEn;
}

export function getCategoryAccent(key: AnyCategoryKey): 'clay' | 'teal' | 'marigold' {
  return getCategoryDef(key).accent;
}

export function getCategoryIcon(key: AnyCategoryKey): string {
  return getCategoryDef(key).icon;
}
