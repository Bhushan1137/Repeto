import type { RecurrenceRule, RecurrenceType } from '@/types';

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

export function getTaskGroup(days: number): 'overdue' | 'today' | 'week' | 'month' {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  return 'month';
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
    case 'weekly':
      return addDays(base, 7).toISOString();
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

export function parseFrequencyLabel(label: string): RecurrenceRule {
  const lower = label.toLowerCase().trim();

  if (/every day|daily|हर दिन/i.test(lower)) return { type: 'daily' };
  if (/every week|weekly|हर हफ्ते/i.test(lower)) return { type: 'weekly' };
  if (/every year|yearly|annual|हर साल/i.test(lower)) return { type: 'yearly' };
  if (/every month|monthly|हर महीने/i.test(lower)) return { type: 'monthly' };

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

  const intervalMatch = lower.match(/every\s+(\d+)\s+days?/i);
  if (intervalMatch) {
    return { type: 'interval', interval: parseInt(intervalMatch[1], 10), intervalUnit: 'days' };
  }

  const hindiDaysMatch = lower.match(/हर\s+(\d+)\s+दिन/);
  if (hindiDaysMatch) {
    return { type: 'interval', interval: parseInt(hindiDaysMatch[1], 10), intervalUnit: 'days' };
  }

  const nthWeekdayMatch = lower.match(
    /(?:every\s+)?(\d+)(?:st|nd|rd|th)?\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)/i
  );
  if (nthWeekdayMatch) {
    const weekday = WEEKDAY_NAMES[nthWeekdayMatch[2].toLowerCase()];
    return { type: 'nthWeekday', nthWeekday: parseInt(nthWeekdayMatch[1], 10), weekday };
  }

  const monthDayMatch = lower.match(/(\d+)(?:st|nd|rd|th)?\s+of\s+month/i);
  if (monthDayMatch) return { type: 'monthDay', dayOfMonth: parseInt(monthDayMatch[1], 10) };

  const hindiDayMatch = lower.match(/(\d+)\s*तारीख/);
  if (hindiDayMatch) return { type: 'monthDay', dayOfMonth: parseInt(hindiDayMatch[1], 10) };

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

export function isCurrentMonth(monthLabel: string): boolean {
  return monthLabel === getMonthLabel();
}

export function computePreviousDueDate(rule: RecurrenceRule, nextDueDateIso: string): string {
  const next = new Date(nextDueDateIso);
  const copy = new Date(next);
  switch (rule.type) {
    case 'daily':
      copy.setDate(copy.getDate() - 1);
      break;
    case 'weekly':
      copy.setDate(copy.getDate() - 7);
      break;
    case 'monthly':
      copy.setMonth(copy.getMonth() - 1);
      break;
    case 'yearly':
      copy.setFullYear(copy.getFullYear() - 1);
      break;
    case 'interval': {
      const n = rule.interval ?? 30;
      if (rule.intervalUnit === 'months') {
        copy.setMonth(copy.getMonth() - n);
      } else {
        copy.setDate(copy.getDate() - n);
      }
      break;
    }
    case 'monthDay': {
      copy.setMonth(copy.getMonth() - 1);
      break;
    }
    case 'nthWeekday': {
      copy.setDate(copy.getDate() - 28);
      break;
    }
    default:
      copy.setDate(copy.getDate() - 30);
  }
  return copy.toISOString();
}
