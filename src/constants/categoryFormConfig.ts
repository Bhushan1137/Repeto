import type { CategoryKey, RecurrenceRule, RecurrenceType } from '@/types';
import type { TranslationKey } from '@/i18n';

export interface CategoryFormConfig {
  titlePlaceholder: TranslationKey;
  subtitle?: TranslationKey;
  showAmount: boolean;
  amountRequired?: boolean;
  showFinance: boolean;
  showReminderTime: boolean;
  showStartDate: boolean;
  defaultRecurrence: RecurrenceRule;
  allowedRecurrenceTypes: RecurrenceType[];
  defaultReminderTime?: string;
}

export const CATEGORY_FORM_CONFIG: Record<CategoryKey, CategoryFormConfig> = {
  bills: {
    titlePlaceholder: 'catPlaceholderBills',
    showAmount: true,
    amountRequired: true,
    showFinance: true,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthDay', dayOfMonth: 5 },
    allowedRecurrenceTypes: ['monthDay', 'monthly', 'interval'],
  },
  finance: {
    titlePlaceholder: 'catPlaceholderFinance',
    showAmount: true,
    showFinance: true,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthDay', dayOfMonth: 1 },
    allowedRecurrenceTypes: ['monthDay', 'monthly', 'yearly', 'interval'],
  },
  subs: {
    titlePlaceholder: 'catPlaceholderSubs',
    showAmount: true,
    showFinance: true,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthly' },
    allowedRecurrenceTypes: ['monthly', 'yearly', 'monthDay'],
  },
  home: {
    titlePlaceholder: 'catPlaceholderHome',
    showAmount: false,
    showFinance: false,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'interval', interval: 30, intervalUnit: 'days' },
    allowedRecurrenceTypes: ['interval', 'monthly', 'monthDay'],
  },
  help: {
    titlePlaceholder: 'catPlaceholderHelp',
    showAmount: true,
    amountRequired: true,
    showFinance: true,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthDay', dayOfMonth: 1 },
    allowedRecurrenceTypes: ['monthDay', 'monthly'],
  },
  vehicle: {
    titlePlaceholder: 'catPlaceholderVehicle',
    showAmount: false,
    showFinance: false,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'interval', interval: 6, intervalUnit: 'months' },
    allowedRecurrenceTypes: ['interval', 'yearly', 'nthWeekday'],
  },
  health: {
    titlePlaceholder: 'catPlaceholderHealth',
    subtitle: 'catSubtitleHealth',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'daily' },
    defaultReminderTime: '08:00',
    allowedRecurrenceTypes: ['daily', 'weekly', 'interval'],
  },
  personal: {
    titlePlaceholder: 'catPlaceholderPersonal',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'monthly' },
    defaultReminderTime: '10:00',
    allowedRecurrenceTypes: ['weekly', 'monthly', 'interval'],
  },
  education: {
    titlePlaceholder: 'catPlaceholderEducation',
    showAmount: true,
    showFinance: true,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthDay', dayOfMonth: 10 },
    allowedRecurrenceTypes: ['monthDay', 'monthly', 'interval', 'yearly'],
  },
  kids: {
    titlePlaceholder: 'catPlaceholderKids',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'weekly', weekday: 6 },
    defaultReminderTime: '16:00',
    allowedRecurrenceTypes: ['weekly', 'monthly', 'daily'],
  },
  pets: {
    titlePlaceholder: 'catPlaceholderPets',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'interval', interval: 30, intervalUnit: 'days' },
    defaultReminderTime: '09:00',
    allowedRecurrenceTypes: ['interval', 'weekly', 'monthly'],
  },
  festival: {
    titlePlaceholder: 'catPlaceholderFestival',
    showAmount: false,
    showFinance: false,
    showReminderTime: false,
    showStartDate: true,
    defaultRecurrence: { type: 'yearly' },
    allowedRecurrenceTypes: ['yearly'],
  },
};

export function getCategoryFormConfig(category: CategoryKey): CategoryFormConfig {
  return CATEGORY_FORM_CONFIG[category];
}
