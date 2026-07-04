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
  | 'kids';

export type RecurrenceType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'interval'
  | 'monthDay'
  | 'nthWeekday';

export type TaskGroup = 'overdue' | 'today' | 'week' | 'month';

export type CompletionStatus = 'on_time' | 'late' | 'missed' | 'skipped';

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

export interface TaskHistoryEntry {
  month: string;
  status: CompletionStatus;
  completedAt?: string;
  note?: string;
  completedBy?: string;
}

export interface RepeatingTask {
  id: string;
  title: string;
  category: CategoryKey;
  recurrence: RecurrenceRule;
  frequencyLabel: string;
  nextDueDate: string;
  amount?: number;
  finance: boolean;
  reminderTime?: string;
  sharedWith: SharedMember[];
  assignedTo?: string;
  history: TaskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  snoozedUntil?: string;
  escalationCount: number;
  pinned?: boolean;
  archived?: boolean;
  archivedAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  language: Language;
  pushOptIn: boolean;
  profileComplete: boolean;
  onboardingComplete: boolean;
  plan: 'free' | 'plus';
  householdCode?: string;
  householdMembers?: HouseholdMemberProfile[];
}

export interface AppState {
  user: UserProfile | null;
  tasks: RepeatingTask[];
}

export interface ParsedTaskInput {
  title: string;
  frequencyLabel: string;
  recurrence: RecurrenceRule;
  amount?: number;
  category: CategoryKey;
  reminderTime?: string;
  assignedTo?: string;
}
