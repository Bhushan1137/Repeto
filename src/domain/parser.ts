import type { CategoryKey, DetectedToken, ParsedTaskInput, RecurrenceRule } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { formatTime12 } from '@/utils/timeFormat';
import { getDefaultDoseTimes, normalizeReminderTimes } from '@/domain/taskForm';
import { frequencyLabelFromRule } from '@/domain/recurrence';

export function guessCategory(text: string): CategoryKey {
  const lower = text.toLowerCase();
  if (/plant|पौधे|गमले|garden|gardening|flower/i.test(lower)) return 'home';
  if (/rent|bill|card|emi|किराया|बिल|बिजली|water\s*bill|पानी\s*का\s*बिल|electricity|recharge|maintenance|phone|wifi|broadband|dth/i.test(lower)) return 'bills';
  if (/sip|itr|tax|fd|invest|mutual|share|stock|टैक्स|निवेश|loan|interest/i.test(lower)) return 'finance';
  if (/bike|car|puc|insurance|petrol|diesel|fuel|service|बाइक|वाहन|गाड़ी|स्कूटर/i.test(lower)) return 'vehicle';
  if (/gas|cylinder|filter|ro|clean|home|house|गैस|घर|plumber|ac service|grocery|ration|राशन|सब्जी|milk|दूध/i.test(lower)) return 'home';
  if (/maid|cook|driver|salary|help|नौकरानी|वेतन|कामवाली|धोबी|sweeper|gardener/i.test(lower)) return 'help';
  if (/medicine|vitamin|doctor|gym|workout|walk|yoga|health|tablet|syrup|bp|sugar|thyroid|दवा|स्वास्थ्य|कसरत|टहल/i.test(lower)) return 'health';
  if (/ott|netflix|prime|hotstar|spotify|youtube|subscription|membership|सब्सक्रिप्शन/i.test(lower)) return 'subs';
  if (/school|tuition|fee|exam|college|course|class|बुक|किताब|स्कूल|ट्यूशन|फीस/i.test(lower)) return 'education';
  if (/salon|haircut|parlour|spa|groom|grooming|सैलून|हेयरकट|पार्लर/i.test(lower)) return 'personal';
  if (/pet|dog|cat|vet|food|कुत्ता|बिल्ली|पालतू/i.test(lower)) return 'pets';
  if (/kid|child|baby|bus|swim|daycare|डायपर|बच्च|स्कूल बस/i.test(lower)) return 'kids';
  if (/diwali|rakhi|festival|puja|पूजा|त्योहार|दिवाली|होली|ईद/i.test(lower)) return 'festival';
  return 'bills';
}

export function guessIcon(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/plant|पौधे|गमले|garden/i.test(lower)) return '🪴';
  if (/rent|किराया/i.test(lower)) return '🏠';
  if (/credit|card|कार्ड|emi/i.test(lower)) return '💳';
  if (/insurance|बीमा/i.test(lower)) return '🏍️';
  if (/puc|certificate|प्रमाणपत्र/i.test(lower)) return '📄';
  if (/gas|सिलिंडर|सिलेंडर/i.test(lower)) return '🔥';
  if (/ro|filter|फ़िल्टर|पानी/i.test(lower)) return '💧';
  if (/maid|कामवाली|झाडू|sweeper/i.test(lower)) return '🧹';
  if (/cook|खाना|रसोइये/i.test(lower)) return '🍳';
  if (/medicine|bp|दवा|tablet|sugar/i.test(lower)) return '💊';
  if (/vitamin|d3|धूप/i.test(lower)) return '☀️';
  if (/gym|workout|कसरत/i.test(lower)) return '💪';
  if (/walk|टहल/i.test(lower)) return '🚶';
  if (/yoga|योग/i.test(lower)) return '🧘';
  if (/milk|दूध/i.test(lower)) return '🥛';
  if (/grocery|ration|राशन|सब्जी/i.test(lower)) return '🛒';
  if (/wifi|broadband|recharge/i.test(lower)) return '📶';
  if (/ott|netflix|prime|hotstar|टीवी|सब्सक्रिप्शन/i.test(lower)) return '📺';
  if (/sweets|diwali|मिठाई/i.test(lower)) return '🍬';
  if (/rakhi|राखी/i.test(lower)) return '🎁';
  if (/school\s*fee|स्कूल\s*फीस/i.test(lower)) return '🏫';
  if (/tuition|ट्यूशन|क्लास/i.test(lower)) return '📝';
  if (/salon|haircut|कटिंग|सैलून/i.test(lower)) return '💇';
  if (/parlour|makeup|पार्लर/i.test(lower)) return '💅';
  if (/pet|dog|cat|veterinary|कुत्ता|बिल्ली/i.test(lower)) return '🍖';
  if (/vet|checkup|डॉक्टर/i.test(lower)) return '🩺';
  if (/sip|invest|mutual|शेयर/i.test(lower)) return '📈';
  if (/itr|tax|टैक्स/i.test(lower)) return '📁';
  if (/swim|तैराकी/i.test(lower)) return '🏊';
  if (/bus|बस/i.test(lower)) return '🚌';
  return undefined;
}

interface ParsedAmountResult {
  amount?: number;
  rawMatch?: string;
}

export function parseAmountToken(text: string): ParsedAmountResult {
  // 1. Explicit currency symbol or code prefix/suffix (e.g. ₹15000, 15000 rs, inr 15,000, 500 रुपये)
  const currencyMatch = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|lakh)?\b/i)
    || text.match(/\b([\d,]+(?:\.\d+)?)\s*(?:k|thousand|lakh)?\s*(?:₹|rs\.?|inr)\b/i)
    || text.match(/([\d,]+(?:\.\d+)?)\s*(?:रुपये|रू)/i);

  if (currencyMatch) {
    let num = parseFloat(currencyMatch[1].replace(/,/g, ''));
    const multiplier = currencyMatch[2]?.toLowerCase();
    if (multiplier === 'k' || multiplier === 'thousand') num *= 1000;
    if (multiplier === 'lakh') num *= 100000;
    if (!isNaN(num) && num > 0) {
      return { amount: Math.round(num), rawMatch: currencyMatch[0] };
    }
  }

  // 2. Thousands notation without currency (e.g. 15k, 2.5k)
  const kMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(k|thousand|lakh)\b/i);
  if (kMatch) {
    let num = parseFloat(kMatch[1]);
    const multiplier = kMatch[2].toLowerCase();
    if (multiplier === 'k' || multiplier === 'thousand') num *= 1000;
    if (multiplier === 'lakh') num *= 100000;
    if (!isNaN(num) && num > 0) {
      return { amount: Math.round(num), rawMatch: kMatch[0] };
    }
  }

  // 3. Standalone amount following bill/rent/salary keywords or preceded by typical financial words
  const standaloneMatch = text.match(/(?:\b(?:rent|salary|bill|fee|cost|emi)\b|किराया|वेतन|बिल|फीस)\s+(?:of\s+)?([1-9]\d{2,6})\b/i)
    || text.match(/\b([1-9]\d{2,6})\s+(?:rent|salary|bill|fee|emi)\b/i)
    || text.match(/([1-9]\d{2,6})\s*(?:किराया|वेतन|बिल)/i);

  if (standaloneMatch) {
    const num = parseInt(standaloneMatch[1], 10);
    if (!isNaN(num) && num > 0 && !(num >= 2025 && num <= 2030)) {
      return { amount: num, rawMatch: standaloneMatch[1] };
    }
  }

  return {};
}

interface ParsedMultiDoseResult {
  isMultiTime: boolean;
  timesPerDay?: number;
  rawMatch?: string;
}

export function parseMultiDoseToken(text: string): ParsedMultiDoseResult {
  const lower = text.toLowerCase();

  // English: "2 times a day", "3 times daily", "twice a day", "twice daily", "thrice daily"
  const timesMatch = lower.match(/\b([2-5])\s*(?:times|x)\s*(?:a\s*day|daily|per\s*day|every\s*day)?\b/i);
  if (timesMatch) {
    return { isMultiTime: true, timesPerDay: parseInt(timesMatch[1], 10), rawMatch: timesMatch[0] };
  }

  const twiceMatch = lower.match(/\b(twice|thrice)\s*(?:a\s*day|daily|per\s*day)?\b/i);
  if (twiceMatch) {
    const count = twiceMatch[1] === 'thrice' ? 3 : 2;
    return { isMultiTime: true, timesPerDay: count, rawMatch: twiceMatch[0] };
  }

  // Hinglish: "subah shaam", "subah aur shaam", "subah sham" -> 2x daily
  const subahShaamMatch = lower.match(/\b(subah\s*(?:aur\s*)?sha?am(?:\s*ko)?)\b/i);
  if (subahShaamMatch) {
    return { isMultiTime: true, timesPerDay: 2, rawMatch: subahShaamMatch[0] };
  }

  // Hinglish: "din me 2 baar", "din mein 3 bar", "2 baar roz"
  const hinglishBarMatch = lower.match(/(?:din\s*me(?:in)?\s*)?([2-5])\s*ba+r(?:\s*(?:roz|roj|daily))?/i);
  if (hinglishBarMatch) {
    return { isMultiTime: true, timesPerDay: parseInt(hinglishBarMatch[1], 10), rawMatch: hinglishBarMatch[0] };
  }

  // Hindi: "दिन में 2 बार", "दो बार रोज़", "3 बार"
  const hindiDigitMatch = lower.match(/(?:दिन\s*में\s*)?([२३४५2-5])\s*बार(?:\s*(?:रोज़|रोज|प्रतिदिन))?/);
  if (hindiDigitMatch) {
    const digitMap: Record<string, number> = { '२': 2, '३': 3, '४': 4, '५': 5 };
    const raw = hindiDigitMatch[1];
    const count = digitMap[raw] ?? parseInt(raw, 10);
    if (count >= 2 && count <= 5) {
      return { isMultiTime: true, timesPerDay: count, rawMatch: hindiDigitMatch[0] };
    }
  }

  const hindiWordMatch = lower.match(/(?:दिन\s*में\s*)?(दो|तीन|चार|पांच)\s*बार(?:\s*(?:रोज़|रोज|प्रतिदिन))?/);
  if (hindiWordMatch) {
    const wordMap: Record<string, number> = { 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5 };
    const count = wordMap[hindiWordMatch[1]];
    if (count) {
      return { isMultiTime: true, timesPerDay: count, rawMatch: hindiWordMatch[0] };
    }
  }

  return { isMultiTime: false };
}

interface ParsedTimeResult {
  reminderTime?: string;
  reminderTimes?: string[];
  rawMatches: string[];
}

export function parseTimesToken(text: string): ParsedTimeResult {
  const lower = text.toLowerCase();
  const times: string[] = [];
  const rawMatches: string[] = [];

  // Match 12-hour times with AM/PM (e.g. "at 9am", "9am", "9:30 pm", "8:00 AM")
  const ampmRegex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = ampmRegex.exec(lower)) !== null) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3].toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      times.push(`${hh}:${mm}`);
      rawMatches.push(match[0]);
    }
  }

  // Match "at HH:MM" or "at HH" (without am/pm)
  const atRegex = /\bat\s+(\d{1,2})(?::(\d{2}))?\b/gi;
  while ((match = atRegex.exec(lower)) !== null) {
    if (!rawMatches.some((r) => r.includes(match![0]))) {
      const hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        times.push(`${hh}:${mm}`);
        rawMatches.push(match[0]);
      }
    }
  }

  // Hindi times (e.g., "सुबह 9 बजे", "शाम 7:30 बजे", "9 बजे")
  const hindiRegex = /(सुबह|शाम|रात|दोपहर)?\s*(\d{1,2})(?::(\d{2}))?\s*बजे/g;
  while ((match = hindiRegex.exec(lower)) !== null) {
    const period = match[1];
    let hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;
    if (period) {
      if ((period === 'शाम' || period === 'रात' || period === 'दोपहर') && hours < 12) {
        hours += 12;
      }
      if (period === 'सुबह' && hours === 12) {
        hours = 0;
      }
    }
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      times.push(`${hh}:${mm}`);
      rawMatches.push(match[0]);
    }
  }

  return {
    reminderTime: times[0],
    reminderTimes: times.length > 0 ? times : undefined,
    rawMatches,
  };
}

interface ParsedRecurrenceResult {
  recurrence: RecurrenceRule;
  frequencyLabel: string;
  rawMatch?: string;
}

export function parseRecurrenceToken(text: string, lang: 'en' | 'hi' = 'en'): ParsedRecurrenceResult {
  const lower = text.toLowerCase();

  // 1. Monthly on specific day (e.g. "every month on 5th", "monthly on 5th", "monthly 5th", "हर महीने 5 तारीख", "har mahine 5 ko")
  const monthDayMatch = lower.match(/(?:every\s+month|monthly|har\s+mahine)\s+(?:on\s+(?:the\s+)?|ki\s+)?(\d{1,2})(?:\s*(?:st|nd|rd|th|ko|tareekh|tarikh))?/i)
    || lower.match(/(\d{1,2})(?:\s*(?:st|nd|rd|th))?\s+of\s+(?:the\s+)?month/i)
    || lower.match(/\b(\d{1,2})\s*(?:ko|tareekh|tarikh)\b/i)
    || lower.match(/हर\s+महीने\s+(\d{1,2})\s*तारीख/);

  if (monthDayMatch) {
    const day = parseInt(monthDayMatch[1], 10);
    if (day >= 1 && day <= 31) {
      const rule: RecurrenceRule = { type: 'monthDay', dayOfMonth: day };
      return {
        recurrence: rule,
        frequencyLabel: frequencyLabelFromRule(rule, lang),
        rawMatch: monthDayMatch[0],
      };
    }
  }

  // 2. Interval months (e.g. "every 2 months", "हर 3 महीने", "har 2 mahine")
  const intervalMonthsMatch = lower.match(/(?:every|har)\s+(\d+)\s+(?:months?|mahine?)/i)
    || lower.match(/हर\s+(\d+)\s+महीने?/);
  if (intervalMonthsMatch) {
    const interval = parseInt(intervalMonthsMatch[1], 10);
    const rule: RecurrenceRule = interval === 12
      ? { type: 'yearly' }
      : { type: 'interval', interval, intervalUnit: 'months' };
    return {
      recurrence: rule,
      frequencyLabel: frequencyLabelFromRule(rule, lang),
      rawMatch: intervalMonthsMatch[0],
    };
  }

  // 3. Interval days (e.g. "every 15 days", "हर 10 दिन", "15 din me", "har 15 din")
  const intervalDaysMatch = lower.match(/(?:every|har)\s+(\d+)\s+(?:days?|din)/i)
    || lower.match(/(\d+)\s*din\s*me(?:in)?/i)
    || lower.match(/हर\s+(\d+)\s+दिन/);
  if (intervalDaysMatch) {
    const interval = parseInt(intervalDaysMatch[1], 10);
    const rule: RecurrenceRule = { type: 'interval', interval, intervalUnit: 'days' };
    return {
      recurrence: rule,
      frequencyLabel: frequencyLabelFromRule(rule, lang),
      rawMatch: intervalDaysMatch[0],
    };
  }

  // 4. Specific weekday (e.g. "every monday", "weekly on friday", "har sunday")
  const weekdayMatch = lower.match(/(?:every|har|weekly\s+on)\s+\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i);
  if (weekdayMatch) {
    const weekdayMap: Record<string, number> = {
      sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2,
      wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
    };
    const weekday = weekdayMap[weekdayMatch[1].toLowerCase()];
    const rule: RecurrenceRule = { type: 'weekly', weekday };
    return {
      recurrence: rule,
      frequencyLabel: frequencyLabelFromRule(rule, lang),
      rawMatch: weekdayMatch[0],
    };
  }

  // 5. General frequencies: daily, weekly, monthly, yearly (including Hinglish)
  const dailyMatch = lower.match(/\b(daily|every\s*day|everyday|roz|roj|har\s*roz|har\s*roj)\b/i) || lower.match(/(हर\s*दिन|रोज़|रोज|प्रतिदिन)/);
  if (dailyMatch) {
    const rule: RecurrenceRule = { type: 'daily' };
    return { recurrence: rule, frequencyLabel: frequencyLabelFromRule(rule, lang), rawMatch: dailyMatch[0] };
  }

  const weeklyMatch = lower.match(/\b(weekly|every\s*week|har\s*week|har\s*hafte)\b/i) || lower.match(/(हर\s*हफ्ते)/);
  if (weeklyMatch) {
    const rule: RecurrenceRule = { type: 'weekly' };
    return { recurrence: rule, frequencyLabel: frequencyLabelFromRule(rule, lang), rawMatch: weeklyMatch[0] };
  }

  const yearlyMatch = lower.match(/\b(yearly|annually|every\s*year|har\s*saal|har\s*sal)\b/i) || lower.match(/(हर\s*साल)/);
  if (yearlyMatch) {
    const rule: RecurrenceRule = { type: 'yearly' };
    return { recurrence: rule, frequencyLabel: frequencyLabelFromRule(rule, lang), rawMatch: yearlyMatch[0] };
  }

  const monthlyMatch = lower.match(/\b(monthly|every\s*month|har\s*month|har\s*mahine)\b/i) || lower.match(/(हर\s*महीने)/);
  if (monthlyMatch) {
    const rule: RecurrenceRule = { type: 'monthly' };
    return { recurrence: rule, frequencyLabel: frequencyLabelFromRule(rule, lang), rawMatch: monthlyMatch[0] };
  }

  // 6. Intelligent habit-based fallback for lazy non-technical users
  if (/plant|पौधे|गमले|gym|workout|walk|टहल|yoga|दवा|medicine|vitamin|brush|bath|read|water|दूध|milk|newspaper|अखबार/i.test(lower)) {
    const habitRule: RecurrenceRule = { type: 'daily' };
    return {
      recurrence: habitRule,
      frequencyLabel: frequencyLabelFromRule(habitRule, lang),
    };
  }

  if (/rent|किराया|salary|वेतन|maid|कामवाली|cook/i.test(lower)) {
    const rentRule: RecurrenceRule = { type: 'monthDay', dayOfMonth: 1 };
    return {
      recurrence: rentRule,
      frequencyLabel: frequencyLabelFromRule(rentRule, lang),
    };
  }

  // Default fallback to monthly
  const defaultRule: RecurrenceRule = { type: 'monthly' };
  return {
    recurrence: defaultRule,
    frequencyLabel: frequencyLabelFromRule(defaultRule, lang),
  };
}

interface ParsedAlarmResult {
  alarmEnabled?: boolean;
  rawMatch?: string;
}

export function parseAlarmToken(text: string): ParsedAlarmResult {
  const lower = text.toLowerCase();

  // 1. Negative intent: "no alarm", "without alarm", "alarm off", "quiet notification", "silent notification", "push only", "notification only", "बिना अलार्म", "अलार्म बंद", "अलार्म नहीं"
  const negativeMatch = lower.match(
    /\b(?:without\s+alarms?|no\s+alarms?|alarms?\s+off|quiet\s+notifications?|silent\s+notifications?|push\s+only|notifications?\s+only)\b|बिना\s*अलार्म|अलार्म\s*(?:बंद|नहीं)|bina\s*alarm|alarm\s*(?:band|off|mat\s*bajao)/i
  );
  if (negativeMatch) {
    return { alarmEnabled: false, rawMatch: negativeMatch[0] };
  }

  // 2. Explicit positive phrases: "with alarm", "alarm on", "set alarm", "full screen alarm", "fullscreen alarm", "loud alarm", "wake up alarm", "अलार्म के साथ", "अलार्म ऑन", "अलार्म चालू", "अलार्म लगाओ"
  const explicitPositiveMatch = lower.match(
    /\b(?:with\s+alarms?|alarms?\s+on|set\s+alarms?|full\s*screen\s*alarms?|fullscreen\s*alarms?|loud\s*alarms?|wake\s*up\s*alarms?)\b|अलार्म\s*(?:के\s*साथ|ऑन|चालू|लगाओ|लगाएं)|alarm\s*(?:ke\s*sath|lagao|chalu)/i
  );
  if (explicitPositiveMatch) {
    return { alarmEnabled: true, rawMatch: explicitPositiveMatch[0] };
  }

  // 3. Standalone "alarm" / "alarms" / "अलार्म"
  // Avoid treating physical device sensors ("smoke alarm", "fire alarm", "car alarm", "burglar alarm", "security alarm") as toggles
  const standaloneMatch = text.match(/\b(alarms?)\b|अलार्म/i);
  if (standaloneMatch && standaloneMatch.index !== undefined) {
    const prefix = text.slice(0, standaloneMatch.index).trim().toLowerCase();
    const isDeviceSensor = /(?:smoke|fire|car|burglar|security|theft)$/i.test(prefix);
    if (!isDeviceSensor) {
      return { alarmEnabled: true, rawMatch: standaloneMatch[0] };
    }
  }

  return {};
}

export function parseTaskInput(text: string, lang: 'en' | 'hi' = 'en'): ParsedTaskInput {
  if (!text || !text.trim()) {
    return {
      title: lang === 'hi' ? 'नया कार्य' : 'New task',
      frequencyLabel: lang === 'hi' ? 'हर महीने' : 'Every month',
      recurrence: { type: 'monthly' },
      category: 'bills',
    };
  }

  // 1. Extract Amount
  const { amount, rawMatch: amountRaw } = parseAmountToken(text);

  // 2. Extract Multi-Dose
  const { isMultiTime, timesPerDay, rawMatch: doseRaw } = parseMultiDoseToken(text);

  // 3. Extract Times
  const { reminderTime, reminderTimes, rawMatches: timeRaws } = parseTimesToken(text);

  // 4. Extract Recurrence
  const { recurrence, frequencyLabel, rawMatch: recRaw } = parseRecurrenceToken(text, lang);

  // 5. Extract Alarm Toggle
  const { alarmEnabled, rawMatch: alarmRaw } = parseAlarmToken(text);

  // 6. Clean Title Extraction
  let cleanTitle = text;

  const removeToken = (src: string, token?: string) => {
    if (!token) return src;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return src.replace(new RegExp(escaped, 'gi'), ' ');
  };

  if (amountRaw) {
    cleanTitle = removeToken(cleanTitle, amountRaw);
  }
  if (doseRaw) {
    cleanTitle = removeToken(cleanTitle, doseRaw);
  }
  for (const timeRaw of timeRaws) {
    cleanTitle = removeToken(cleanTitle, timeRaw);
  }
  if (recRaw) {
    cleanTitle = removeToken(cleanTitle, recRaw);
  }
  if (alarmRaw) {
    cleanTitle = removeToken(cleanTitle, alarmRaw);
  }

  // Clean trailing prepositions, articles & connectors (including Hindi/Hinglish connectors)
  cleanTitle = cleanTitle
    .replace(/\b(at|on|for|every|in|and|the|with|without|ke|saath|sath|bina|ko|me|mein|se|ki|ka)\b/gi, ' ')
    .replace(/(?:के\s*साथ|के|बिना)/g, ' ')
    .replace(/[₹,.\-—:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If clean title becomes empty, fallback gracefully
  if (!cleanTitle) {
    cleanTitle = text.trim();
  }
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  // 7. Category & Icon
  const category = guessCategory(text);
  const icon = guessIcon(text);

  // 8. Setup multi-dose reminderTimes if multi-time is active
  let finalReminderTimes = reminderTimes;
  if (isMultiTime && timesPerDay && timesPerDay > 1) {
    if (!finalReminderTimes || finalReminderTimes.length === 0) {
      finalReminderTimes = getDefaultDoseTimes(timesPerDay);
    } else if (finalReminderTimes.length < timesPerDay) {
      finalReminderTimes = normalizeReminderTimes(timesPerDay, finalReminderTimes);
    }
  }

  // 9. Detected Tokens for UI Badges
  const detectedTokens: DetectedToken[] = [];

  // Category token
  const catConfig = CATEGORY_MAP[category];
  detectedTokens.push({
    id: 'category',
    label: lang === 'hi' ? catConfig.labelHi : catConfig.labelEn,
    icon: catConfig.icon,
  });

  // Amount token
  if (amount !== undefined) {
    detectedTokens.push({
      id: 'amount',
      label: `₹${amount.toLocaleString('en-IN')}`,
      icon: '💰',
    });
  }

  // Recurrence token (if explicitly matched)
  if (recRaw) {
    detectedTokens.push({
      id: 'recurrence',
      label: frequencyLabel,
      icon: '🔁',
    });
  }

  // Multi-dose token
  if (isMultiTime && timesPerDay && timesPerDay > 1) {
    detectedTokens.push({
      id: 'doses',
      label: lang === 'hi' ? `दिन में ${timesPerDay} बार` : `${timesPerDay} times a day`,
      icon: '⏰',
    });
  }

  // Time token
  if (reminderTime) {
    detectedTokens.push({
      id: 'time',
      label: formatTime12(reminderTime),
      icon: '⏰',
    });
  }

  // Alarm token (if explicitly matched)
  if (alarmEnabled === true) {
    detectedTokens.push({
      id: 'alarm',
      label: lang === 'hi' ? 'अलार्म चालू' : 'Alarm ON',
      icon: '🔔',
    });
  } else if (alarmEnabled === false && alarmRaw) {
    detectedTokens.push({
      id: 'alarm',
      label: lang === 'hi' ? 'अलार्म बंद' : 'Alarm OFF',
      icon: '🔕',
    });
  }

  return {
    title: cleanTitle,
    frequencyLabel,
    recurrence,
    amount,
    category,
    reminderTime: reminderTime ?? (finalReminderTimes && finalReminderTimes[0]),
    isMultiTime,
    timesPerDay,
    reminderTimes: finalReminderTimes,
    icon,
    alarmEnabled,
    detectedTokens,
  };
}
