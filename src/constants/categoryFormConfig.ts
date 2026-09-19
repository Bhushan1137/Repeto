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

const ALL_RECURRENCE_TYPES: RecurrenceType[] = [
  'daily',
  'weekly',
  'monthDay',
  'monthly',
  'nthWeekday',
  'yearly',
  'interval',
];

export const CATEGORY_FORM_CONFIG: Record<CategoryKey, CategoryFormConfig> = {
  bills: {
    titlePlaceholder: 'catPlaceholderBills',
    showAmount: true,
    amountRequired: true,
    showFinance: true,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthDay', dayOfMonth: 5 },
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  finance: {
    titlePlaceholder: 'catPlaceholderFinance',
    showAmount: false,
    showFinance: false,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthDay', dayOfMonth: 1 },
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  subs: {
    titlePlaceholder: 'catPlaceholderSubs',
    showAmount: true,
    showFinance: true,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthly' },
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  home: {
    titlePlaceholder: 'catPlaceholderHome',
    showAmount: true,
    showFinance: true,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'interval', interval: 30, intervalUnit: 'days' },
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  help: {
    titlePlaceholder: 'catPlaceholderHelp',
    showAmount: false,
    showFinance: false,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthDay', dayOfMonth: 1 },
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  vehicle: {
    titlePlaceholder: 'catPlaceholderVehicle',
    showAmount: false,
    showFinance: false,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'interval', interval: 6, intervalUnit: 'months' },
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
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
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  personal: {
    titlePlaceholder: 'catPlaceholderPersonal',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'monthly' },
    defaultReminderTime: '10:00',
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  education: {
    titlePlaceholder: 'catPlaceholderEducation',
    showAmount: false,
    showFinance: false,
    showReminderTime: false,
    showStartDate: false,
    defaultRecurrence: { type: 'monthDay', dayOfMonth: 10 },
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  kids: {
    titlePlaceholder: 'catPlaceholderKids',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'weekly', weekday: 6 },
    defaultReminderTime: '16:00',
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  pets: {
    titlePlaceholder: 'catPlaceholderPets',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'interval', interval: 30, intervalUnit: 'days' },
    defaultReminderTime: '09:00',
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  festival: {
    titlePlaceholder: 'catPlaceholderFestival',
    showAmount: false,
    showFinance: false,
    showReminderTime: false,
    showStartDate: true,
    defaultRecurrence: { type: 'yearly' },
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  shopping: {
    titlePlaceholder: 'catPlaceholderShopping',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'monthly' },
    defaultReminderTime: '10:00',
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  fitness: {
    titlePlaceholder: 'catPlaceholderFitness',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'daily' },
    defaultReminderTime: '07:00',
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  medicines: {
    titlePlaceholder: 'catPlaceholderMedicines',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'daily' },
    defaultReminderTime: '08:00',
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
  work: {
    titlePlaceholder: 'catPlaceholderWork',
    showAmount: false,
    showFinance: false,
    showReminderTime: true,
    showStartDate: false,
    defaultRecurrence: { type: 'weekly', weekday: 1 },
    defaultReminderTime: '09:00',
    allowedRecurrenceTypes: ALL_RECURRENCE_TYPES,
  },
};

export function getCategoryFormConfig(category: CategoryKey): CategoryFormConfig {
  return CATEGORY_FORM_CONFIG[category];
}
