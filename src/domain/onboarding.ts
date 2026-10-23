import type { AnyCategoryKey, CategoryKey } from '@/types';
import { PRESETS, type TaskPreset } from '@/constants/presets';

export interface OnboardingSuggestion {
  title: string;
  titleHi: string;
  freq: string;
  freqHi: string;
  category: AnyCategoryKey;
  amount?: number;
  finance?: boolean;
  accepted: boolean;
  icon?: string;
}

export function buildOnboardingSuggestions(categories: CategoryKey[]): OnboardingSuggestion[] {
  return categories.flatMap((cat) =>
    (PRESETS[cat] || []).map((p: TaskPreset) => ({
      title: p.titleEn,
      titleHi: p.titleHi,
      freq: p.freqEn,
      freqHi: p.freqHi,
      category: cat,
      amount: p.amount,
      finance: p.finance,
      accepted: false,
      icon: p.icon,
    }))
  );
}
