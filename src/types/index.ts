export type Language = 'en' | 'hi';

export type CategoryKey =
  | 'bills'
  | 'vehicle'
  | 'home'
  | 'help'
  | 'health'
  | 'subs'
  | 'festival'
  | 'education'
  | 'personal'
  | 'pets'
  | 'finance'
  | 'kids'
  | 'shopping'
  | 'fitness'
  | 'medicines'
  | 'work'
  | 'supplies'
  | 'maintenance'
  | 'documents'
  | 'gardening';

/** Runtime key for user-created categories — prefixed `custom_<uuid>` */
export type CustomCategoryKey = `custom_${string}`;

/** Union of built-in + custom category keys used across the app */
export type AnyCategoryKey = CategoryKey | CustomCategoryKey;

/** A user-defined category stored in local AsyncStorage */
export interface CustomCategoryDef {
  /** Unique key — always starts with `custom_` */
  key: CustomCategoryKey;
  labelEn: string;
  labelHi?: string;       // optional Hindi label
  icon: string;           // emoji
  /** Visual accent — reuses existing palette tokens */
  accent: 'clay' | 'teal' | 'marigold';
  /** Lifecycle group */
  group: 'money' | 'home' | 'life';
  createdAt: string;      // ISO timestamp
  /** Optional default recurrence label (e.g. "Every month") */
  defaultFreqLabel?: string;
}

export type RecurrenceType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'interval'
  | 'monthDay'
  | 'nthWeekday';

export type TaskGroup = 'overdue' | 'today' | 'week' | 'month' | 'later';

export type CompletionStatus = 'on_time' | 'late' | 'missed' | 'skipped' | 'snoozed';

export interface RecurrenceRule {
  type: RecurrenceType;
  interval?: number;
  /** Unit for `interval` type — defaults to days */
  intervalUnit?: 'days' | 'months';
  dayOfMonth?: number;
  /** 0=Sun … 6=Sat — used with nthWeekday */
  weekday?: number;
  /** Nth occurrence in month (e.g. 2 = "2nd Saturday") */
  nthWeekday?: number;
}

export interface SharedMember {
  name: string;
  phone: string;
  color: string;
  code?: string;
  userId?: string;
}

export interface HouseholdMemberProfile {
  code: string;
  name: string;
  color: string;
  userId?: string;
  phone?: string;
  addedAt: string;
  status: 'active' | 'pending';
}

export interface UserCodeProfile {
  userCode: string;
  userId: string;
  name: string;
  color: string;
  photoUrl?: string;
}

/** A single household context — users can have up to 5 */
export interface HouseholdContext {
  id: string;         // UUID, e.g. "home-a1b2c3"
  name: string;       // User-assigned label, e.g. "Home" / "Office"
  icon: string;       // Emoji, e.g. "🏠" | "🏢"
  ownerUid: string;   // UID of the household creator/admin
  code?: string;      // Legacy code field
  members: HouseholdMemberProfile[];
  memberUids: string[];
  createdAt: string;
  color: string;      // Accent hex for the context pill UI
}

export interface TaskHistoryEntry {
  month: string;
  status: CompletionStatus;
  completedAt?: string;
  note?: string;
  completedBy?: string;
  previousAssignee?: string;
  rotatedTo?: string;
  previousDueDate?: string;
  doseIndex?: number;
  doseTime?: string;
}

export interface RepeatingTask {
  id: string;
  householdId?: string | null; // Belongs to a specific HouseholdContext (null for personal tasks)
  title: string;
  icon?: string;
  category: AnyCategoryKey;
  recurrence: RecurrenceRule;
  frequencyLabel: string;
  nextDueDate: string;
  amount?: number;
  finance: boolean;
  reminderTime?: string;
  timesPerDay?: number;
  reminderTimes?: string[];
  startDate?: string;
  sharedWith: SharedMember[];
  assignedTo?: string;
  isRotating?: boolean;
  rotationMembers?: string[];
  history: TaskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  snoozedUntil?: string;
  escalationCount: number;
  pinned?: boolean;
  archived?: boolean;
  archivedAt?: string;
  creatorName?: string;
  /** true = fullscreen native alarm; false/undefined = standard push notification */
  alarmEnabled?: boolean;
  note?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  userCode?: string;   // Permanent personal code e.g. "RPT-9X8Y7Z"
  language: Language;
  languageSelected?: boolean;
  pushOptIn: boolean;
  expoPushToken?: string;
  profileComplete: boolean;
  onboardingComplete: boolean;
  plan: 'free' | 'plus';
  /** Legacy single-household — kept for backward compat */
  householdCode?: string;
  /** Legacy member list — kept for backward compat */
  householdMembers?: HouseholdMemberProfile[];
  /** Legacy uid list — kept for backward compat */
  householdMemberUids?: string[];
  /** NEW: all household contexts (multi-household) */
  households?: HouseholdContext[];
  /** NEW: which household is currently active */
  activeHouseholdId?: string;
  removedBy?: string;
  termsAcceptedAt?: string;
  /** Soft-delete fields — set when user requests account deletion */
  isDeleted?: boolean;
  deletedAt?: string;
  deletionReason?: string;
  /** ISO timestamp after which a server-side job may permanently purge the data */
  purgeAfter?: string;
  /** Activity tracking for presence & device diagnostics */
  lastActiveAt?: string;
  deviceInfo?: {
    platform: 'ios' | 'android' | 'web';
    appVersion: string;
    osVersion?: string;
  };
}

export interface AppState {
  user: UserProfile | null;
  tasks: RepeatingTask[];
}

export interface DetectedToken {
  id: 'amount' | 'time' | 'recurrence' | 'category' | 'doses' | 'alarm';
  label: string;
  icon: string;
}

export interface ParsedTaskInput {
  title: string;
  icon?: string;
  frequencyLabel: string;
  recurrence: RecurrenceRule;
  amount?: number;
  category: AnyCategoryKey;
  reminderTime?: string;
  timesPerDay?: number;
  isMultiTime?: boolean;
  reminderTimes?: string[];
  startDate?: string;
  assignedTo?: string;
  isRotating?: boolean;
  rotationMembers?: string[];
  detectedTokens?: DetectedToken[];
  /** true = fullscreen native alarm; false/undefined = standard push notification */
  alarmEnabled?: boolean;
  note?: string;
}

