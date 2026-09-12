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
  | 'work';

export type RecurrenceType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'interval'
  | 'monthDay'
  | 'nthWeekday';

export type TaskGroup = 'overdue' | 'today' | 'week' | 'month';

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
}

export interface RepeatingTask {
  id: string;
  householdId?: string | null; // Belongs to a specific HouseholdContext (null for personal tasks)
  title: string;
  icon?: string;
  category: CategoryKey;
  recurrence: RecurrenceRule;
  frequencyLabel: string;
  nextDueDate: string;
  amount?: number;
  finance: boolean;
  reminderTime?: string;
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
}

export interface AppState {
  user: UserProfile | null;
  tasks: RepeatingTask[];
}

export interface ParsedTaskInput {
  title: string;
  icon?: string;
  frequencyLabel: string;
  recurrence: RecurrenceRule;
  amount?: number;
  category: CategoryKey;
  reminderTime?: string;
  startDate?: string;
  assignedTo?: string;
  isRotating?: boolean;
  rotationMembers?: string[];
}
