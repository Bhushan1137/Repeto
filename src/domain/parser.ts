import type { CategoryKey, DetectedToken, ParsedTaskInput, RecurrenceRule } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { formatTime12 } from '@/utils/timeFormat';
import { getDefaultDoseTimes, normalizeReminderTimes } from '@/domain/taskForm';
import { frequencyLabelFromRule } from '@/domain/recurrence';

export function guessCategory(text: string): CategoryKey {
  const lower = text.toLowerCase();
  if (/plant|पौधे|गमले|garden|gardening|flower|khad|fertilizer|vermicompost|neem\s*oil|pruning|gudai|गुड़ाई|watering|seed/i.test(lower)) return 'gardening';
  if (/milk|दूध|water\s*(?:can|jar|bottle)|पानी\s*जार|lpg|gas\s*cylinder|गैस\s*सिलेंडर|सिलिंडर|cylinder|dhobi|धोबी|ironing|istri|newspaper|अखबार|ration|kachra|garbage|trash|कचरा/i.test(lower)) return 'supplies';
  if (/ac\s*(?:service|servicing|filter)|ro\s*(?:service|filter|purifier|membrane)|chimney|water\s*tank|टंकी|inverter|geyser|गीजर|appliance|deep\s*clean|pest\s*control|plumber|electrician|sofa\s*clean/i.test(lower)) return 'maintenance';
  if (/fastag|फास्टैग|metro\s*(?:card|pass)|puc|pollution|property\s*tax|house\s*tax|driving\s*licen[sc]e|passport|voter|aadhaar|aadhar|pan\s*card/i.test(lower)) return 'documents';
  if (/rent|bill|card|emi|किराया|बिल|बिजली|water\s*bill|पानी\s*का\s*बिल|electricity|bijli|recharge|maintenance|phone|wifi|broadband|dth|postpaid|piped\s*gas|tata\s*play|jio/i.test(lower)) return 'bills';
  if (/sip|itr|tax|fd|rd|invest|mutual|share|stock|टैक्स|निवेश|loan|interest|lic|ppf|nps|gst|crypto/i.test(lower)) return 'finance';
  if (/bike|car|insurance|petrol|diesel|fuel|service|बाइक|वाहन|गाड़ी|स्कूटर|scooty|car\s*wash|air\s*pressure|tyre|tire|chain\s*lube|engine\s*oil/i.test(lower)) return 'vehicle';
  if (/filter|clean|home|house|घर|grocery|सब्जी|laundry|bedsheet|dusting|mop|broom|jhadu|pocha/i.test(lower)) return 'home';
  if (/maid|cook|driver|salary|help|नौकरानी|वेतन|कामवाली|sweeper|gardener|bai/i.test(lower)) return 'help';
  if (/medicine|vitamin|doctor|dentist|gym|workout|walk|run|yoga|pilates|health|tablet|capsule|syrup|bp|sugar|thyroid|insulin|d3|b12|checkup|test|दवा|स्वास्थ्य|कसरत|टहल/i.test(lower)) return 'health';
  if (/ott|netflix|prime|hotstar|spotify|youtube|apple|icloud|chatgpt|subscription|membership|सब्सक्रिप्शन|audible|gym\s*membership/i.test(lower)) return 'subs';
  if (/school|tuition|fee|exam|college|course|class|बुक|किताब|स्कूल|ट्यूशन|फीस|coaching/i.test(lower)) return 'education';
  if (/salon|haircut|parlour|spa|groom|grooming|सैलून|हेयरकट|पार्लर|facial|skincare|sunscreen|beard|shaving/i.test(lower)) return 'personal';
  if (/pet|dog|cat|puppy|kitten|vet|veterinary|dog\s*food|cat\s*food|pedigree|whiskas|कुत्ता|बिल्ली|पालतू/i.test(lower)) return 'pets';
  if (/kid|child|baby|bus|swim|daycare|creche|डायपर|बच्च|स्कूल बस/i.test(lower)) return 'kids';
  if (/diwali|rakhi|festival|puja|पूजा|त्योहार|दिवाली|होली|ईद|sweets/i.test(lower)) return 'festival';
  return 'bills';
}

export function guessIcon(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/plant|पौधे|गमले|garden|flower|khad|neem/i.test(lower)) return '🪴';
  if (/milk|दूध/i.test(lower)) return '🥛';
  if (/fastag|फास्टैग|metro|puc|licen[sc]e|passport|दस्तावेज़|aadhaar|pan/i.test(lower)) return '🪪';
  if (/ac|chimney|geyser|appliance|inverter|maintenance|गीजर|plumber|electrician/i.test(lower)) return '🔧';
  if (/water\s*(?:can|jar)|tank|टंकी/i.test(lower)) return '🚰';
  if (/dhobi|ironing|istri|धोबी/i.test(lower)) return '👔';
  if (/rent|किराया/i.test(lower)) return '🏠';
  if (/credit|card|कार्ड|emi/i.test(lower)) return '💳';
  if (/insurance|बीमा|lic/i.test(lower)) return '🏍️';
  if (/certificate|प्रमाणपत्र/i.test(lower)) return '📄';
  if (/gas|सिलिंडर|सिलेंडर|lpg/i.test(lower)) return '🔥';
  if (/ro|filter|फ़िल्टर|पानी/i.test(lower)) return '💧';
  if (/maid|कामवाली|झाडू|sweeper|dusting|jhadu/i.test(lower)) return '🧹';
  if (/cook|खाना|रसोइये/i.test(lower)) return '🍳';
  if (/medicine|bp|दवा|tablet|sugar|capsule|thyroid|insulin/i.test(lower)) return '💊';
  if (/vitamin|d3|धूप/i.test(lower)) return '☀️';
  if (/gym|workout|कसरत|pilates/i.test(lower)) return '💪';
  if (/walk|टहल|running|run/i.test(lower)) return '🚶';
  if (/yoga|योग/i.test(lower)) return '🧘';
  if (/grocery|ration|राशन|सब्जी/i.test(lower)) return '🛒';
  if (/wifi|broadband|recharge/i.test(lower)) return '📶';
  if (/ott|netflix|prime|hotstar|टीवी|सब्सक्रिप्शन|youtube/i.test(lower)) return '📺';
  if (/spotify|music|गाने/i.test(lower)) return '🎧';
  if (/sweets|diwali|मिठाई/i.test(lower)) return '🍬';
  if (/rakhi|राखी/i.test(lower)) return '🎁';
  if (/school\s*fee|स्कूल\s*फीस|college/i.test(lower)) return '🏫';
  if (/tuition|ट्यूशन|क्लास|coaching/i.test(lower)) return '📝';
  if (/salon|haircut|कटिंग|सैलून|beard|shave/i.test(lower)) return '💇';
  if (/parlour|makeup|पार्लर|facial|skincare/i.test(lower)) return '💅';
  if (/pet|dog|puppy|कुत्ता/i.test(lower)) return '🐕';
  if (/cat|kitten|बिल्ली/i.test(lower)) return '🐈';
  if (/vet|checkup|डॉक्टर|dentist/i.test(lower)) return '🩺';
  if (/sip|invest|mutual|शेयर|stock|fund/i.test(lower)) return '📈';
  if (/itr|tax|टैक्स|gst/i.test(lower)) return '📁';
  if (/swim|तैराकी/i.test(lower)) return '🏊';
  if (/bus|बस/i.test(lower)) return '🚌';
  if (/car|गाड़ी/i.test(lower)) return '🚗';
  if (/bike|स्कूटर|बाइक/i.test(lower)) return '🏍️';
  if (/electricity|बिजली|power/i.test(lower)) return '⚡';
  if (/trash|kachra|garbage|कचरा/i.test(lower)) return '🗑️';
  return undefined;
}

interface ParsedAmountResult {
  amount?: number;
  rawMatch?: string;
}

export function parseAmountToken(text: string): ParsedAmountResult {
  // 1. Suffix `/-` notation (e.g. 15000/-, 500/-, ₹ 1500/-, rs 3500/-)
  const slashDashMatch = text.match(/(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*\/-/i);
  if (slashDashMatch) {
    const num = parseFloat(slashDashMatch[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      return { amount: Math.round(num), rawMatch: slashDashMatch[0] };
    }
  }

  // 2. Explicit currency symbol or code prefix/suffix (e.g. ₹15000, 15000 rs, inr 15,000, ₹ 15k, 500 रुपये, 15000 rupaye)
  const currencyMatch = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|lakh|crore)?(?:\s*\/(?:month|mo|day|yr|year|mahina|din))?\b/i)
    || text.match(/\b([\d,]+(?:\.\d+)?)\s*(?:k|thousand|lakh|crore)?\s*(?:₹|rs\.?|inr|rupaye?|rupees?)(?:\s*\/(?:month|mo|day|yr|year|mahina|din))?\b/i)
    || text.match(/([\d,]+(?:\.\d+)?)\s*(?:रुपये|रू)/i);

  if (currencyMatch) {
    let num = parseFloat(currencyMatch[1].replace(/,/g, ''));
    const multiplier = currencyMatch[2]?.toLowerCase();
    if (multiplier === 'k' || multiplier === 'thousand') num *= 1000;
    if (multiplier === 'lakh') num *= 100000;
    if (multiplier === 'crore') num *= 10000000;
    if (!isNaN(num) && num > 0) {
      return { amount: Math.round(num), rawMatch: currencyMatch[0] };
    }
  }

  // 3. Thousands, hundreds, lakh notation without currency (e.g. 15k, 2.5k, 1.5 lakh, 4 hazar, 5 sau)
  const kMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(k|thousand|lakh|crore|haza?ar|sau)\b/i);
  if (kMatch) {
    let num = parseFloat(kMatch[1]);
    const multiplier = kMatch[2].toLowerCase();
    if (multiplier === 'sau') num *= 100;
    else if (multiplier === 'k' || multiplier === 'thousand' || multiplier.startsWith('haza')) num *= 1000;
    else if (multiplier === 'lakh') num *= 100000;
    else if (multiplier === 'crore') num *= 10000000;
    if (!isNaN(num) && num > 0) {
      return { amount: Math.round(num), rawMatch: kMatch[0] };
    }
  }

  // 4. Rate suffix notation without explicit currency symbol (e.g. 60/day, 999/mo, 1500/month)
  const rateMatch = text.match(/\b([\d,]+(?:\.\d+)?)\s*\/(?:month|mo|day|yr|year|mahina|din)\b/i);
  if (rateMatch) {
    const num = parseFloat(rateMatch[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      return { amount: Math.round(num), rawMatch: rateMatch[0] };
    }
  }

  // 4. Standalone amount following bill/rent/salary keywords or preceded by typical financial words
  const standaloneMatch = text.match(/(?:\b(?:rent|salary|bill|fee|cost|emi|recharge|sip|installment)\b|किराया|वेतन|बिल|फीस)\s+(?:of\s+)?([1-9]\d{2,6})\b/i)
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

  // 3 periods in a day: "morning afternoon evening", "subah dopahar shaam", "morning noon night" -> 3 times daily
  const threePeriodsMatch = lower.match(/\b(subah\s*(?:,|\baur\s*)?dopahar\s*(?:,|\baur\s*)?sha?am(?:\s*ko)?)\b/i)
    || lower.match(/\b(morning\s*(?:,|\band\s*)?(?:afternoon|noon)\s*(?:,|\band\s*)?(?:evening|night))\b/i)
    || lower.match(/(सुबह\s*(?:और\s*)?दोपहर\s*(?:और\s*)?शाम)/);
  if (threePeriodsMatch) {
    return { isMultiTime: true, timesPerDay: 3, rawMatch: threePeriodsMatch[0] };
  }

  // Hinglish / English: "subah shaam", "subah aur shaam", "morning and evening", "morning and night" -> 2x daily
  const subahShaamMatch = lower.match(/\b(subah\s*(?:aur\s*|&)?sha?am(?:\s*ko)?)\b/i)
    || lower.match(/\b(morning\s*(?:and|&)\s*(?:evening|night))\b/i)
    || lower.match(/(सुबह\s*(?:और\s*)?शाम)/);
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

  // 1. Match 12-hour times with AM/PM (e.g. "at 9am", "9am", "9:30 pm", "8:00 AM")
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

  // 2. Hinglish times with "baje" (e.g. "7 baje", "9:30 baje", "subah 8 baje", "shaam 7:30 baje", "raat 10 baje")
  const hinglishBajeRegex = /\b(?:(subah|sha?am|raat|dopahar)\s+)?(\d{1,2})(?::(\d{2}))?\s*baje(?:\s*(subah|sha?am|raat|dopahar))?\b/gi;
  while ((match = hinglishBajeRegex.exec(lower)) !== null) {
    if (!rawMatches.some((r) => r.includes(match![0]))) {
      const period = match[1] || match[4];
      let hours = parseInt(match[2], 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;
      if (period) {
        if (/^(sha?am|raat|dopahar)$/i.test(period) && hours < 12) hours += 12;
        if (/^subah$/i.test(period) && hours === 12) hours = 0;
      }
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        times.push(`${hh}:${mm}`);
        rawMatches.push(match[0]);
      }
    }
  }

  // 3. Hindi times with "बजे" (e.g. "सुबह 9 बजे", "शाम 7:30 बजे", "9 बजे")
  const hindiRegex = /(सुबह|शाम|रात|दोपहर)?\s*(\d{1,2})(?::(\d{2}))?\s*बजे/g;
  while ((match = hindiRegex.exec(lower)) !== null) {
    if (!rawMatches.some((r) => r.includes(match![0]))) {
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
  }

  // 4. English casual times with period words (e.g. "7 in the morning", "8 in the evening", "10 at night")
  const englishPeriodRegex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:in\s+the\s+|at\s+)?(morning|afternoon|evening|night)\b/gi;
  while ((match = englishPeriodRegex.exec(lower)) !== null) {
    if (!rawMatches.some((r) => r.includes(match![0]))) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3].toLowerCase();
      if ((period === 'evening' || period === 'night') && hours < 12) {
        hours += 12;
      } else if (period === 'afternoon' && hours <= 6) {
        hours += 12;
      }
      if (period === 'morning' && hours === 12) hours = 0;
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        times.push(`${hh}:${mm}`);
        rawMatches.push(match[0]);
      }
    }
  }

  // 5. Match "at HH:MM" or "at HH" (without am/pm)
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

  // 6. Semantic time period defaults if NO numeric time was found
  // (e.g. "morning", "evening", "subah", "shaam", "night", "before bed")
  if (times.length === 0) {
    const morningMatch = lower.match(/\b(?:in\s+the\s+)?(morning|subah)\b|सुबह/i);
    const eveningMatch = lower.match(/\b(?:in\s+the\s+)?(evening|sha?am)\b|शाम/i);
    const afternoonMatch = lower.match(/\b(?:in\s+the\s+)?(afternoon|dopahar)\b|दोपहर/i);
    const nightMatch = lower.match(/\b(?:at\s+)?(night|bedtime|before\s+bed|raat)\b|रात/i);

    if (morningMatch) {
      times.push('08:00');
      rawMatches.push(morningMatch[0]);
    } else if (eveningMatch) {
      times.push('19:00');
      rawMatches.push(eveningMatch[0]);
    } else if (afternoonMatch) {
      times.push('13:00');
      rawMatches.push(afternoonMatch[0]);
    } else if (nightMatch) {
      times.push('21:30');
      rawMatches.push(nightMatch[0]);
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

  // 1. Alternate days / Every other day (interval 2 days)
  const alternateMatch = lower.match(/\b(every\s+other\s+day|alternate\s+days?|every\s+alternate\s+day|on\s+alternate\s+days?|ek\s+din\s+ch(?:h)?od\s+(?:kar|ke)|har\s+d(?:u|oo)sre?\s+din)\b/i)
    || lower.match(/(हर\s+दूसरे\s+दिन|एक\s+दिन\s+छोड़कर)/);
  if (alternateMatch) {
    const rule: RecurrenceRule = { type: 'interval', interval: 2, intervalUnit: 'days' };
    return {
      recurrence: rule,
      frequencyLabel: frequencyLabelFromRule(rule, lang),
      rawMatch: alternateMatch[0],
    };
  }

  // 2. Bi-weekly / Fortnightly / Every 2 weeks (interval 14 days)
  const biweeklyMatch = lower.match(/\b(biweekly|bi-weekly|fortnightly|every\s+2\s+weeks?|every\s+two\s+weeks?|har\s+2\s+hafte|har\s+do\s+hafte)\b/i)
    || lower.match(/(हर\s+2\s+हफ्ते|हर\s+दो\s+हफ्ते|पाक्षिक)/);
  if (biweeklyMatch) {
    const rule: RecurrenceRule = { type: 'interval', interval: 14, intervalUnit: 'days' };
    return {
      recurrence: rule,
      frequencyLabel: frequencyLabelFromRule(rule, lang),
      rawMatch: biweeklyMatch[0],
    };
  }

  // 3. Quarterly / Every 3 months (interval 3 months)
  const quarterlyMatch = lower.match(/\b(quarterly|every\s+quarter|every\s+3\s+months?|every\s+three\s+months?|har\s+3\s+mahine|har\s+teen\s+mahine)\b/i)
    || lower.match(/(हर\s+3\s+महीने|हर\s+तीन\s+महीने|त्रैमासिक)/);
  if (quarterlyMatch) {
    const rule: RecurrenceRule = { type: 'interval', interval: 3, intervalUnit: 'months' };
    return {
      recurrence: rule,
      frequencyLabel: frequencyLabelFromRule(rule, lang),
      rawMatch: quarterlyMatch[0],
    };
  }

  // 4. Half-yearly / Semi-annually / Every 6 months (interval 6 months)
  const halfYearlyMatch = lower.match(/\b(half\s*yearly|half-yearly|semi-annually|every\s+6\s+months?|every\s+six\s+months?|har\s+6\s+mahine|har\s+chheh\s+mahine)\b/i)
    || lower.match(/(हर\s+6\s+महीने|छमाही)/);
  if (halfYearlyMatch) {
    const rule: RecurrenceRule = { type: 'interval', interval: 6, intervalUnit: 'months' };
    return {
      recurrence: rule,
      frequencyLabel: frequencyLabelFromRule(rule, lang),
      rawMatch: halfYearlyMatch[0],
    };
  }

  // 5. Month End / Last day of month
  const monthEndMatch = lower.match(/\b(month\s*end|end\s+of\s+(?:the\s+)?month|last\s+day\s+of\s+(?:the\s+)?month|mahine\s+ke\s+(?:aakhri|aakhiri|end)\s+(?:din|me)?)\b/i)
    || lower.match(/(महीने\s+के\s+अंत\s+में|महीने\s+का\s+आखिरी\s+दिन)/);
  if (monthEndMatch) {
    const rule: RecurrenceRule = { type: 'monthDay', dayOfMonth: 31 };
    return {
      recurrence: rule,
      frequencyLabel: lang === 'hi' ? 'महीने के अंत में' : 'End of month',
      rawMatch: monthEndMatch[0],
    };
  }

  // 6. Monthly on specific day (e.g. "every month on 5th", "monthly on 5th", "monthly 5th", "हर महीने 5 तारीख", "har mahine 5 ko", "on 5th", "on the 5th", "5th of every month")
  const monthDayMatch = lower.match(/(?:every\s+month|monthly|har\s+mahine)\s+(?:on\s+(?:the\s+)?|ki\s+)?(\d{1,2})(?:\s*(?:st|nd|rd|th|ko|tareekh|tarikh))?/i)
    || lower.match(/(\d{1,2})(?:\s*(?:st|nd|rd|th))?\s+of\s+(?:the\s+|each\s+|every\s+)?month/i)
    || lower.match(/\b(?:on\s+(?:the\s+)?|every\s+)(\d{1,2})\s*(?:st|nd|rd|th)\b/i)
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

  // 7. Interval months (e.g. "every 2 months", "हर 3 महीने", "har 2 mahine")
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

  // 8. Interval days (e.g. "every 15 days", "हर 10 दिन", "15 din me", "har 15 din")
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

  // 9. Specific weekday (e.g. "every monday", "weekly on friday", "har sunday")
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

  // 10. Weekdays (Monday to Friday)
  const weekdayGeneralMatch = lower.match(/\b(weekdays?|every\s*weekday|on\s*weekdays?|mon(?:day)?\s*(?:to|-)\s*fri(?:day)?)\b/i)
    || lower.match(/(कार्यदिवस)/);
  if (weekdayGeneralMatch) {
    const rule: RecurrenceRule = { type: 'daily' };
    return {
      recurrence: rule,
      frequencyLabel: lang === 'hi' ? 'सोम - शुक्र (कार्यदिवस)' : 'Weekdays (Mon-Fri)',
      rawMatch: weekdayGeneralMatch[0],
    };
  }

  // 11. General frequencies: daily, weekly, monthly, yearly
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

  // 12. Intelligent habit-based fallback for lazy non-technical users
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

  // 1. Negative intent: "no alarm", "without alarm", "alarm off", "quiet notification", "silent notification", "push only", "notifications only", "बिना अलार्म", "अलार्म बंद", "अलार्म नहीं"
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
    .replace(/(?:के\s*साथ|के|बिना|को|में)/g, ' ')
    .replace(/[₹,.\-—:;/]/g, ' ')
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
