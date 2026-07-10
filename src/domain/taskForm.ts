import type { CategoryKey, Language, ParsedTaskInput, RecurrenceRule, RecurrenceType, RepeatingTask } from '@/types';
import { getCategoryFormConfig } from '@/constants/categoryFormConfig';
import { frequencyLabelFromRule, parseFrequencyLabel } from '@/domain/recurrence';
import type { TranslationKey } from '@/i18n';

export interface TaskFormValues {
  title: string;
  category: CategoryKey;
  recurrence: RecurrenceRule;
  freq: string;
  amount?: number;
  finance: boolean;
  reminderTime?: string;
  startDate?: string;
  assignedTo?: string;
  icon?: string;
}

export interface TaskFormState {
  title: string;
  category: CategoryKey;
  recurrenceType: RecurrenceType;
  dayOfMonth: number;
  weekday: number;
  interval: number;
  intervalUnit: 'days' | 'months';
  nthWeekday: number;
  amountText: string;
  finance: boolean;
  reminderTime: string | null;
  startDate: string | null;
  assignedTo: string | null;
  icon: string | null;
}

export const RECURRENCE_TYPE_OPTIONS: RecurrenceType[] = [
  'daily',
  'weekly',
  'monthly',
  'monthDay',
  'interval',
  'yearly',
  'nthWeekday',
];

export function recurrenceTypeLabel(type: RecurrenceType, lang: Language): string {
  const labels: Record<RecurrenceType, { en: string; hi: string }> = {
    daily: { en: 'Every day', hi: 'हर दिन' },
    weekly: { en: 'Every week', hi: 'हर हफ्ते' },
    monthly: { en: 'Every month', hi: 'हर महीने' },
    monthDay: { en: 'On a specific day each month', hi: 'हर महीने की तारीख' },
    interval: { en: 'Custom interval', hi: 'कस्टम अंतराल' },
    yearly: { en: 'Every year', hi: 'हर साल' },
    nthWeekday: { en: 'Nth weekday of month', hi: 'महीने का Nth दिन' },
  };
  return labels[type][lang];
}

export function weekdayLabel(day: number, lang: Language): string {
  const en = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  return lang === 'hi' ? hi[day] : en[day];
}

export function nthLabel(n: number, lang: Language): string {
  if (lang === 'hi') return `${n}वां`;
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
}

export function buildRecurrenceRule(state: Pick<
  TaskFormState,
  'recurrenceType' | 'dayOfMonth' | 'weekday' | 'interval' | 'intervalUnit' | 'nthWeekday'
>): RecurrenceRule {
  switch (state.recurrenceType) {
    case 'daily':
      return { type: 'daily' };
    case 'weekly':
      return { type: 'weekly', weekday: state.weekday };
    case 'monthly':
      return { type: 'monthly' };
    case 'monthDay':
      return { type: 'monthDay', dayOfMonth: state.dayOfMonth };
    case 'yearly':
      return { type: 'yearly' };
    case 'interval':
      return { type: 'interval', interval: state.interval, intervalUnit: state.intervalUnit };
    case 'nthWeekday':
      return { type: 'nthWeekday', nthWeekday: state.nthWeekday, weekday: state.weekday };
    default:
      return { type: 'monthly' };
  }
}

export function recurrenceToFormState(rule: RecurrenceRule): Pick<
  TaskFormState,
  'recurrenceType' | 'dayOfMonth' | 'weekday' | 'interval' | 'intervalUnit' | 'nthWeekday'
> {
  return {
    recurrenceType: rule.type,
    dayOfMonth: rule.dayOfMonth ?? 1,
    weekday: rule.weekday ?? 1,
    interval: rule.interval ?? 30,
    intervalUnit: rule.intervalUnit ?? 'days',
    nthWeekday: rule.nthWeekday ?? 1,
  };
}

export function defaultFormState(category: CategoryKey = 'bills'): TaskFormState {
  const config = getCategoryFormConfig(category);
  const rec = recurrenceToFormState(config.defaultRecurrence);
  return {
    title: '',
    category,
    ...rec,
    amountText: '',
    finance: config.showFinance,
    reminderTime: config.defaultReminderTime ?? null,
    startDate: null,
    assignedTo: null,
    icon: null,
  };
}

export function formStateFromValues(values: TaskFormValues): TaskFormState {
  const rec = recurrenceToFormState(values.recurrence);
  return {
    title: values.title,
    category: values.category,
    ...rec,
    amountText: values.amount ? String(values.amount) : '',
    finance: values.finance,
    reminderTime: values.reminderTime ?? null,
    startDate: values.startDate ?? null,
    assignedTo: values.assignedTo ?? null,
    icon: values.icon ?? null,
  };
}

export function formStateFromParsed(parsed: ParsedTaskInput): TaskFormState {
  const config = getCategoryFormConfig(parsed.category);
  const rec = recurrenceToFormState(parsed.recurrence);
  return {
    title: parsed.title,
    category: parsed.category,
    ...rec,
    amountText: parsed.amount ? String(parsed.amount) : '',
    finance: config.showFinance && !!parsed.amount,
    reminderTime: parsed.reminderTime ?? config.defaultReminderTime ?? null,
    startDate: null,
    assignedTo: null,
    icon: parsed.icon ?? null,
  };
}

export function formStateFromTask(task: RepeatingTask): TaskFormState {
  const rec = recurrenceToFormState(task.recurrence);
  return {
    title: task.title,
    category: task.category,
    ...rec,
    amountText: task.amount ? String(task.amount) : '',
    finance: task.finance,
    reminderTime: task.reminderTime ?? getCategoryFormConfig(task.category).defaultReminderTime ?? null,
    startDate: null,
    assignedTo: task.assignedTo ?? null,
    icon: task.icon ?? null,
  };
}

export function applyCategoryChange(state: TaskFormState, category: CategoryKey): TaskFormState {
  const config = getCategoryFormConfig(category);
  const rec = recurrenceToFormState(config.defaultRecurrence);
  const allowed = config.allowedRecurrenceTypes;
  const recurrenceType = allowed.includes(rec.recurrenceType) ? rec.recurrenceType : allowed[0];
  const nextRec = recurrenceToFormState(
    config.defaultRecurrence.type === recurrenceType
      ? config.defaultRecurrence
      : { type: recurrenceType }
  );
  return {
    ...state,
    category,
    ...nextRec,
    finance: config.showFinance ? state.finance || config.showAmount : false,
    reminderTime: config.showReminderTime ? (state.reminderTime ?? config.defaultReminderTime ?? null) : null,
    startDate: config.showStartDate ? state.startDate : null,
  };
}

export function formStateToValues(state: TaskFormState, lang: Language): TaskFormValues {
  const recurrence = buildRecurrenceRule(state);
  const amountDigits = state.amountText.replace(/\D/g, '');
  const amount = amountDigits ? Number(amountDigits) : undefined;
  const config = getCategoryFormConfig(state.category);

  return {
    title: state.title.trim(),
    category: state.category,
    recurrence,
    freq: frequencyLabelFromRule(recurrence, lang),
    amount,
    finance: config.showFinance && (state.finance || !!amount),
    reminderTime: config.showReminderTime && state.reminderTime ? state.reminderTime : undefined,
    startDate: config.showStartDate && state.startDate ? state.startDate : undefined,
    assignedTo: state.assignedTo || undefined,
    icon: state.icon || undefined,
  };
}

export function formStateFromLegacyFreq(
  title: string,
  freq: string,
  category: CategoryKey,
  amount?: number,
  finance?: boolean,
  lang: Language = 'en',
  icon?: string
): TaskFormState {
  const recurrence = parseFrequencyLabel(freq);
  const base = formStateFromValues({
    title,
    category,
    recurrence,
    freq,
    amount,
    finance: finance ?? !!amount,
    icon,
  });
  return base;
}

export interface TaskFormErrors {
  title?: string;
  amount?: string;
  recurrence?: string;
}

export function validateFormState(
  state: TaskFormState,
  translate: (key: TranslationKey) => string
): TaskFormErrors {
  const errors: TaskFormErrors = {};
  const config = getCategoryFormConfig(state.category);

  if (state.title.trim().length < 2) errors.title = translate('presetTitleRequired');
  if (config.showAmount && config.amountRequired && !state.amountText.replace(/\D/g, '')) {
    errors.amount = translate('amountRequired');
  }
  if (state.recurrenceType === 'interval' && state.interval < 1) {
    errors.recurrence = translate('intervalRequired');
  }

  return errors;
}

export function dayOfMonthOptions(): { value: number; labelEn: string; labelHi: string }[] {
  return Array.from({ length: 28 }, (_, i) => {
    const d = i + 1;
    return { value: d, labelEn: `${d}`, labelHi: `${d}` };
  });
}

export function intervalPresets(category: CategoryKey): number[] {
  switch (category) {
    case 'vehicle':
      return [3, 6, 12];
    case 'home':
    case 'pets':
    case 'health':
      return [7, 15, 30, 90];
    case 'education':
      return [1, 3, 6, 12];
    default:
      return [7, 15, 30, 60, 90];
  }
}

export function findSchedulingConflicts(
  state: TaskFormState,
  tasks: RepeatingTask[],
  editingTaskId?: string
): RepeatingTask[] {
  if (!state.reminderTime) return [];

  const stateRule = buildRecurrenceRule(state);
  const stateTimeParts = state.reminderTime.split(':');
  const stateMins = parseInt(stateTimeParts[0], 10) * 60 + parseInt(stateTimeParts[1], 10);

  return tasks.filter((t) => {
    if (t.id === editingTaskId || !t.reminderTime) return false;

    // 1. Compare recurrence rules
    let ruleMatches = false;
    const tr = t.recurrence;
    if (tr.type === stateRule.type) {
      if (tr.type === 'daily' || tr.type === 'monthly' || tr.type === 'yearly') {
        ruleMatches = true;
      } else if (tr.type === 'weekly') {
        ruleMatches = tr.weekday === stateRule.weekday;
      } else if (tr.type === 'monthDay') {
        ruleMatches = tr.dayOfMonth === stateRule.dayOfMonth;
      } else if (tr.type === 'nthWeekday') {
        ruleMatches = tr.nthWeekday === stateRule.nthWeekday && tr.weekday === stateRule.weekday;
      } else if (tr.type === 'interval') {
        ruleMatches = tr.interval === stateRule.interval && tr.intervalUnit === stateRule.intervalUnit;
      }
    }

    if (!ruleMatches) return false;

    // 2. Compare reminder times (within 30 mins)
    const tTimeParts = t.reminderTime.split(':');
    const tMins = parseInt(tTimeParts[0], 10) * 60 + parseInt(tTimeParts[1], 10);
    return Math.abs(stateMins - tMins) <= 30;
  });
}
