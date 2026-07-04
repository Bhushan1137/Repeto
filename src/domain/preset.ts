import type { CategoryKey, Language, RepeatingTask } from '@/types';
import { PRESETS, type TaskPreset } from '@/constants/presets';
import type { OnboardingSuggestion } from '@/domain/onboarding';
import { parseFrequencyLabel } from '@/domain/recurrence';
import {
  formStateFromLegacyFreq,
  formStateFromTask,
  formStateFromValues,
  formStateToValues,
  type TaskFormState,
  type TaskFormValues,
} from '@/domain/taskForm';

export type { TaskFormValues, TaskFormState };

export interface PresetListItem {
  id: string;
  category: CategoryKey;
  title: string;
  titleHi: string;
  freq: string;
  freqHi: string;
  amount?: number;
  finance?: boolean;
}

export function getAllPresets(): PresetListItem[] {
  return (Object.keys(PRESETS) as CategoryKey[]).flatMap((category) =>
    (PRESETS[category] ?? []).map((p, i) => ({
      id: `${category}-${i}`,
      category,
      title: p.titleEn,
      titleHi: p.titleHi,
      freq: p.freqEn,
      freqHi: p.freqHi,
      amount: p.amount,
      finance: p.finance,
    }))
  );
}

export function presetToFormValues(preset: PresetListItem, language: Language): TaskFormValues {
  const freq = language === 'hi' ? preset.freqHi : preset.freq;
  const state = formStateFromLegacyFreq(
    language === 'hi' ? preset.titleHi : preset.title,
    freq,
    preset.category,
    preset.amount,
    preset.finance ?? !!preset.amount,
    language
  );
  return formStateToValues(state, language);
}

export function suggestionToFormValues(s: OnboardingSuggestion, language: Language): TaskFormValues {
  const freq = language === 'hi' ? s.freqHi : s.freq;
  const state = formStateFromLegacyFreq(
    language === 'hi' ? s.titleHi : s.title,
    freq,
    s.category,
    s.amount,
    s.finance ?? !!s.amount,
    language
  );
  return formStateToValues(state, language);
}

export function taskToFormValues(task: RepeatingTask, language: Language = 'en'): TaskFormValues {
  return formStateToValues(formStateFromTask(task), language);
}

export function formValuesToSuggestionPatch(
  values: TaskFormValues,
  language: Language
): Partial<OnboardingSuggestion> {
  const patch: Partial<OnboardingSuggestion> = {
    category: values.category,
    amount: values.amount,
    finance: values.finance || !!values.amount,
    accepted: true,
  };
  if (language === 'hi') {
    patch.titleHi = values.title;
    patch.freqHi = values.freq;
  } else {
    patch.title = values.title;
    patch.freq = values.freq;
  }
  return patch;
}

export function formValuesFromState(state: TaskFormState, language: Language): TaskFormValues {
  return formStateToValues(state, language);
}

export function stateFromFormValues(values: TaskFormValues): TaskFormState {
  return formStateFromValues(values);
}

export function presetFromTaskPreset(p: TaskPreset, category: CategoryKey): PresetListItem {
  return {
    id: `${category}-${p.titleEn}`,
    category,
    title: p.titleEn,
    titleHi: p.titleHi,
    freq: p.freqEn,
    freqHi: p.freqHi,
    amount: p.amount,
    finance: p.finance,
  };
}

/** @deprecated use formStateToValues — kept for parser bridge */
export function freqFromValues(values: TaskFormValues, lang: Language): string {
  return values.freq || formStateToValues(formStateFromValues(values), lang).freq;
}

export { parseFrequencyLabel };
