import type { CategoryKey } from '@/types';

export interface CategoryDef {
  key: CategoryKey;
  labelEn: string;
  labelHi: string;
  icon: string;
  accent: 'clay' | 'teal' | 'marigold';
  group: 'money' | 'home' | 'life';
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'bills', labelEn: 'Bills & EMI', labelHi: 'बिल और EMI', icon: '💳', accent: 'clay', group: 'money' },
  { key: 'finance', labelEn: 'Savings & Tax', labelHi: 'बचत और टैक्स', icon: '📈', accent: 'teal', group: 'money' },
  { key: 'subs', labelEn: 'Subscriptions', labelHi: 'सब्सक्रिप्शन', icon: '📺', accent: 'marigold', group: 'money' },
  { key: 'home', labelEn: 'Home & Utilities', labelHi: 'घर और उपयोगिता', icon: '🏠', accent: 'marigold', group: 'home' },
  { key: 'help', labelEn: 'Domestic Help', labelHi: 'घरेलू सहायता', icon: '🧹', accent: 'clay', group: 'home' },
  { key: 'vehicle', labelEn: 'Vehicle', labelHi: 'वाहन', icon: '🛵', accent: 'teal', group: 'home' },
  { key: 'health', labelEn: 'Health & Wellness', labelHi: 'स्वास्थ्य', icon: '💊', accent: 'teal', group: 'life' },
  { key: 'personal', labelEn: 'Personal Care', labelHi: 'व्यक्तिगत देखभाल', icon: '✂️', accent: 'marigold', group: 'life' },
  { key: 'education', labelEn: 'Education', labelHi: 'शिक्षा', icon: '📚', accent: 'clay', group: 'life' },
  { key: 'kids', labelEn: 'Kids & Family', labelHi: 'बच्चे और परिवार', icon: '👶', accent: 'marigold', group: 'life' },
  { key: 'pets', labelEn: 'Pet Care', labelHi: 'पालतू देखभाल', icon: '🐾', accent: 'teal', group: 'life' },
  { key: 'festival', labelEn: 'Festivals & Rituals', labelHi: 'त्योहार', icon: '🪔', accent: 'marigold', group: 'life' },
];

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<CategoryKey, CategoryDef>;

export const CATEGORY_GROUPS: { key: CategoryDef['group']; labelEn: string; labelHi: string }[] = [
  { key: 'money', labelEn: 'Money', labelHi: 'पैसे' },
  { key: 'home', labelEn: 'Home', labelHi: 'घर' },
  { key: 'life', labelEn: 'Life', labelHi: 'जीवन' },
];
