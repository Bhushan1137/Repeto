import type { RecurrenceRule, RecurrenceType, TaskGroup } from '@/types';

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  const originalDay = copy.getDate();
  copy.setDate(1); // avoid wrapping overflow when changing months
  copy.setMonth(copy.getMonth() + months);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(originalDay, lastDay));
  return copy;
}

function setDayOfMonth(d: Date, day: number): Date {
  const copy = new Date(d);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, lastDay));
  return copy;
}

const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/** Find the Nth weekday (e.g. 2nd Saturday) on or after `from` */
function nextNthWeekday(from: Date, weekday: number, nth: number): Date {
  const base = startOfDay(from);
  let year = base.getFullYear();
  let month = base.getMonth();

  for (let attempt = 0; attempt < 24; attempt++) {
    let count = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const candidate = new Date(year, month, day);
      if (candidate.getDay() === weekday) {
        count += 1;
        if (count === nth) {
          if (candidate >= base) return candidate;
        }
      }
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return addDays(base, 7);
}

export function daysUntilDue(dueDateIso: string, from: Date = new Date()): number {
  const due = startOfDay(new Date(dueDateIso));
  const today = startOfDay(from);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getTaskGroup(days: number): TaskGroup {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'later';
}

export function dayLabel(days: number, lang: 'en' | 'hi'): string {
  if (days < 0) {
    const n = Math.abs(days);
    return lang === 'hi' ? `${n} दिन देर` : `${n}d late`;
  }
  if (days === 0) return lang === 'hi' ? 'आज' : 'Today';
  if (days === 1) return lang === 'hi' ? 'कल' : 'Tmrw';
  return lang === 'hi' ? `${days} दिन` : `${days}d`;
}

export function shortDayLabel(days: number, lang: 'en' | 'hi'): string {
  if (days < 0) {
    const n = Math.abs(days);
    if (lang === 'hi') return `${n} दिन\nदेर`;
    return `${n} ${n === 1 ? 'Day' : 'Days'}\noverdue`;
  }
  if (days === 0) return lang === 'hi' ? 'आज' : 'Today';
  if (days === 1) return lang === 'hi' ? 'कल' : 'Tomorrow';
  if (lang === 'hi') return `${days} दिन\nशेष`;
  return `${days} ${days === 1 ? 'Day' : 'Days'}\nleft`;
}

export function daysPercent(days: number): number {
  if (days < 0) return 100;
  return Math.max(6, 100 - (Math.min(days, 30) / 30) * 100);
}

export function computeNextDueDate(rule: RecurrenceRule, from: Date = new Date()): string {
  const base = startOfDay(from);

  switch (rule.type) {
    case 'daily':
      return addDays(base, 1).toISOString();
    case 'weekly': {
      if (rule.weekday !== undefined) {
        const next = addDays(base, 1);
        const diff = (rule.weekday - next.getDay() + 7) % 7;
        return addDays(next, diff).toISOString();
      }
      return addDays(base, 7).toISOString();
    }
    case 'monthly':
      return addMonths(base, 1).toISOString();
    case 'yearly':
      return addMonths(base, 12).toISOString();
    case 'interval': {
      const n = rule.interval ?? 30;
      if (rule.intervalUnit === 'months') return addMonths(base, n).toISOString();
      return addDays(base, n).toISOString();
    }
    case 'monthDay': {
      let next = setDayOfMonth(addMonths(base, 0), rule.dayOfMonth ?? 1);
      if (next <= base) {
        next = setDayOfMonth(addMonths(base, 1), rule.dayOfMonth ?? 1);
      }
      return next.toISOString();
    }
    case 'nthWeekday': {
      const weekday = rule.weekday ?? 6;
      const nth = rule.nthWeekday ?? 1;
      const next = nextNthWeekday(addDays(base, 1), weekday, nth);
      return next.toISOString();
    }
    default:
      return addDays(base, 30).toISOString();
  }
}

/**
 * Checks if a given calendar date matches the recurrence constraints.
 */
export function matchesRecurrenceOnDate(rule: RecurrenceRule, date: Date): boolean {
  switch (rule.type) {
    case 'daily':
      return true;
    case 'weekly':
      return rule.weekday === undefined || rule.weekday === date.getDay();
    case 'monthly':
      return true;
    case 'monthDay':
      return rule.dayOfMonth === undefined || rule.dayOfMonth === date.getDate();
    case 'yearly':
      return true;
    case 'interval':
      return true;
    case 'nthWeekday': {
      if (rule.weekday !== undefined && rule.weekday !== date.getDay()) return false;
      const nth = Math.ceil(date.getDate() / 7);
      return rule.nthWeekday === undefined || rule.nthWeekday === nth;
    }
    default:
      return true;
  }
}

/**
 * Finds the earliest date on or after `from` that satisfies the recurrence rule constraints.
 */
export function alignToRuleOnOrAfter(rule: RecurrenceRule, from: Date): string {
  const base = startOfDay(from);
  switch (rule.type) {
    case 'daily':
    case 'monthly':
    case 'yearly':
    case 'interval':
      return base.toISOString();
    case 'weekly': {
      if (rule.weekday === undefined || rule.weekday === base.getDay()) {
        return base.toISOString();
      }
      const diff = (rule.weekday - base.getDay() + 7) % 7;
      return addDays(base, diff).toISOString();
    }
    case 'monthDay': {
      const targetDay = rule.dayOfMonth ?? 1;
      if (base.getDate() === targetDay) {
        return base.toISOString();
      }
      if (base.getDate() < targetDay) {
        return setDayOfMonth(base, targetDay).toISOString();
      }
      return setDayOfMonth(addMonths(base, 1), targetDay).toISOString();
    }
    case 'nthWeekday': {
      const weekday = rule.weekday ?? 6;
      const nth = rule.nthWeekday ?? 1;
      const currentNth = Math.ceil(base.getDate() / 7);
      if (base.getDay() === weekday && currentNth === nth) {
        return base.toISOString();
      }
      return nextNthWeekday(base, weekday, nth).toISOString();
    }
    default:
      return base.toISOString();
  }
}

/**
 * Computes the initial due date for a newly created, scheduled, or updated task.
 * If the selected date & time is in the future relative to `now`, the first occurrence
 * is scheduled on that date (e.g. today if the reminder time has not yet passed).
 * If the time has already passed on that date, it advances to the next occurrence.
 */
export function computeInitialDueDate(
  rule: RecurrenceRule,
  startDate?: string | null,
  reminderTime?: string | null,
  now: Date = new Date(),
  reminderTimes?: string[] | null
): string {
  let base: Date;
  if (startDate) {
    const parts = startDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      base = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      base = new Date(startDate);
    }
  } else {
    base = new Date(now);
  }
  base = startOfDay(base);

  const timesToCheck =
    reminderTimes && reminderTimes.length > 0
      ? reminderTimes
      : (reminderTime ? [reminderTime] : ['09:00']);

  let hasFutureTimeToday = false;
  for (const timeStr of timesToCheck) {
    const [h, m] = timeStr.split(':').map(Number);
    const hour = !isNaN(h) ? h : 9;
    const minute = !isNaN(m) ? m : 0;
    const targetWithTime = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hour,
      minute,
      0,
      0
    );
    if (targetWithTime.getTime() > now.getTime()) {
      hasFutureTimeToday = true;
      break;
    }
  }

  const todayStart = startOfDay(now);

  // If start date is in the future (> today), find first valid occurrence on or after base
  if (base.getTime() > todayStart.getTime()) {
    return alignToRuleOnOrAfter(rule, base);
  }

  // If start date is today:
  if (base.getTime() === todayStart.getTime()) {
    // If target reminder time is later than now, today is valid!
    if (hasFutureTimeToday && matchesRecurrenceOnDate(rule, base)) {
      return base.toISOString();
    }
    // Target time already passed today (or today doesn't match rule): advance to next occurrence
    return computeNextDueDate(rule, base);
  }

  // If start date is in the past (< today), advance from base until on/after today or next due
  return computeNextDueDate(rule, base);
}

export function parseFrequencyLabel(label: string): RecurrenceRule {
  const lower = label.toLowerCase().trim();

  // 1. Specific day of month (e.g. "every month on 5th", "monthly on 5th", "monthly 5th", "5th of month", "5 तारीख")
  const explicitMonthDayMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+of\s+month/i)
    || lower.match(/(?:every\s+month|monthly)\s+(?:on\s+(?:the\s+)?)?(\d{1,2})(?:st|nd|rd|th)?/i)
    || lower.match(/(\d{1,2})\s*तारीख/);

  if (explicitMonthDayMatch) {
    const day = parseInt(explicitMonthDayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return { type: 'monthDay', dayOfMonth: day };
    }
  }

  // 2. Nth weekday (e.g. "2nd Saturday", "every 1st Sunday")
  const nthWeekdayMatch = lower.match(
    /(?:every\s+)?(\d+)(?:st|nd|rd|th)?\s+\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i
  );
  if (nthWeekdayMatch) {
    const weekday = WEEKDAY_NAMES[nthWeekdayMatch[2].toLowerCase()];
    return { type: 'nthWeekday', nthWeekday: parseInt(nthWeekdayMatch[1], 10), weekday };
  }

  // 3. Specific weekday (e.g. "every monday", "every sunday")
  const weekdayMatch = lower.match(
    /(?:every|weekly\s+on)\s+\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i
  );
  if (weekdayMatch) {
    const weekday = WEEKDAY_NAMES[weekdayMatch[1].toLowerCase()];
    return { type: 'weekly', weekday };
  }

  // 4. Interval months (e.g. "every 2 months", "हर 3 महीने")
  const monthsMatch = lower.match(/every\s+(\d+)\s+months?/i);
  if (monthsMatch) {
    const n = parseInt(monthsMatch[1], 10);
    if (n === 12) return { type: 'yearly' };
    return { type: 'interval', interval: n, intervalUnit: 'months' };
  }

  const hindiMonthsMatch = lower.match(/हर\s+(\d+)\s+महीने?/);
  if (hindiMonthsMatch) {
    return { type: 'interval', interval: parseInt(hindiMonthsMatch[1], 10), intervalUnit: 'months' };
  }

  // 5. Interval days (e.g. "every 15 days", "हर 10 दिन")
  const intervalMatch = lower.match(/every\s+(\d+)\s+days?/i);
  if (intervalMatch) {
    return { type: 'interval', interval: parseInt(intervalMatch[1], 10), intervalUnit: 'days' };
  }

  const hindiDaysMatch = lower.match(/हर\s+(\d+)\s+दिन/);
  if (hindiDaysMatch) {
    return { type: 'interval', interval: parseInt(hindiDaysMatch[1], 10), intervalUnit: 'days' };
  }

  // 6. Common base frequencies
  if (/every day|daily|हर दिन|रोज़|रोज/i.test(lower)) return { type: 'daily' };
  if (/every week|weekly|हर हफ्ते/i.test(lower)) return { type: 'weekly' };
  if (/every year|yearly|annual|annually|हर साल/i.test(lower)) return { type: 'yearly' };
  if (/every month|monthly|हर महीने/i.test(lower)) return { type: 'monthly' };

  return { type: 'monthly' };
}

export function frequencyLabelFromRule(rule: RecurrenceRule, lang: 'en' | 'hi'): string {
  const labels: Record<RecurrenceType, { en: string; hi: string }> = {
    daily: { en: 'Every day', hi: 'हर दिन' },
    weekly: { en: 'Every week', hi: 'हर हफ्ते' },
    monthly: { en: 'Every month', hi: 'हर महीने' },
    yearly: { en: 'Every year', hi: 'हर साल' },
    interval: {
      en:
        rule.intervalUnit === 'months'
          ? `Every ${rule.interval ?? 1} months`
          : `Every ${rule.interval ?? 30} days`,
      hi:
        rule.intervalUnit === 'months'
          ? `हर ${rule.interval ?? 1} महीने`
          : `हर ${rule.interval ?? 30} दिन`,
    },
    monthDay: {
      en: `Every ${rule.dayOfMonth ?? 1}${ordinalSuffix(rule.dayOfMonth ?? 1)} of month`,
      hi: `हर महीने की ${rule.dayOfMonth ?? 1} तारीख`,
    },
    nthWeekday: {
      en: `Every ${rule.nthWeekday ?? 1}${ordinalSuffix(rule.nthWeekday ?? 1)} ${weekdayName(rule.weekday ?? 6, 'en')}`,
      hi: `हर महीने का ${rule.nthWeekday ?? 1} ${weekdayName(rule.weekday ?? 6, 'hi')}`,
    },
  };
  return labels[rule.type][lang];
}

function weekdayName(day: number, lang: 'en' | 'hi'): string {
  const en = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  return lang === 'hi' ? hi[day] : en[day];
}

export function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function getMonthLabel(date: Date = new Date()): string {
  return date.toLocaleString('en', { month: 'short', year: 'numeric' });
}

export function isCurrentMonth(monthLabel: string, date: Date = new Date()): boolean {
  if (!monthLabel) return false;
  if (monthLabel === getMonthLabel(date)) return true;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return monthLabel === `${yyyy}-${mm}`;
}

export function computePreviousDueDate(rule: RecurrenceRule, nextDueDateIso: string): string {
  const next = new Date(nextDueDateIso);
  switch (rule.type) {
    case 'daily':
      return addDays(next, -1).toISOString();
    case 'weekly':
      return addDays(next, -7).toISOString();
    case 'monthly':
      return addMonths(next, -1).toISOString();
    case 'yearly':
      return addMonths(next, -12).toISOString();
    case 'interval': {
      const n = rule.interval ?? 30;
      if (rule.intervalUnit === 'months') {
        return addMonths(next, -n).toISOString();
      }
      return addDays(next, -n).toISOString();
    }
    case 'monthDay': {
      return setDayOfMonth(addMonths(next, -1), rule.dayOfMonth ?? 1).toISOString();
    }
    case 'nthWeekday': {
      return addDays(next, -28).toISOString();
    }
    default:
      return addDays(next, -30).toISOString();
  }
}
