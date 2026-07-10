import type { CategoryKey, ParsedTaskInput } from '@/types';
import { parseFrequencyLabel } from '@/domain/recurrence';

function guessCategory(text: string): CategoryKey {
  const lower = text.toLowerCase();
  if (/rent|bill|card|emi|किराया|बिल/i.test(lower)) return 'bills';
  if (/sip|itr|tax|fd|invest|mutual|टैक्स|निवेश/i.test(lower)) return 'finance';
  if (/bike|car|puc|insurance|petrol|बाइक|वाहन/i.test(lower)) return 'vehicle';
  if (/gas|filter|ro|clean|home|गैस|घर/i.test(lower)) return 'home';
  if (/maid|cook|driver|salary|help|नौकरानी|वेतन/i.test(lower)) return 'help';
  if (/medicine|vitamin|doctor|gym|health|दवा|स्वास्थ्य/i.test(lower)) return 'health';
  if (/ott|netflix|subscription|membership|सब्सक्रिप्शन/i.test(lower)) return 'subs';
  if (/school|tuition|fee|exam|college|स्कूल|ट्यूशन|फीस/i.test(lower)) return 'education';
  if (/salon|haircut|parlour|spa|groom|सैलून|हेयरकट/i.test(lower)) return 'personal';
  if (/pet|dog|cat|vet|पालतू|कुत्ता/i.test(lower)) return 'pets';
  if (/kid|child|bus|swim|daycare|बच्च|स्कूल बस/i.test(lower)) return 'kids';
  if (/diwali|rakhi|festival|puja|त्योहार|दिवाली/i.test(lower)) return 'festival';
  return 'bills';
}

function parseReminderTime(text: string): string | undefined {
  const lower = text.toLowerCase().trim();

  // English 12-hour or 24-hour time match
  // e.g. "at 9am", "at 10:30 pm", "at 9:00 AM", "at 18:30"
  const enMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (enMatch) {
    let hours = parseInt(enMatch[1], 10);
    const minutes = enMatch[2] ? parseInt(enMatch[2], 10) : 0;
    const ampm = enMatch[3];

    if (ampm) {
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
    }

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }

  // Hindi time match (e.g., "9 बजे", "शाम 6:30 बजे", "सुबह 9:00 बजे")
  const hiMatch = lower.match(/(सुबह|शाम|रात|दोपहर)?\s*(\d{1,2})(?::(\d{2}))?\s*बजे/);
  if (hiMatch) {
    const period = hiMatch[1];
    let hours = parseInt(hiMatch[2], 10);
    const minutes = hiMatch[3] ? parseInt(hiMatch[3], 10) : 0;

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
      return `${hh}:${mm}`;
    }
  }

  return undefined;
}

function guessIcon(text: string): string | undefined {
  const lower = text.toLowerCase();
  
  if (/rent|किराया/i.test(lower)) return '🏠';
  if (/credit|card|कार्ड|emi/i.test(lower)) return '💳';
  if (/insurance|बीमा/i.test(lower)) return '🏍️';
  if (/puc|certificate|प्रमाणपत्र/i.test(lower)) return '📄';
  if (/gas|सिलिंडर/i.test(lower)) return '🔥';
  if (/ro|filter|फ़िल्टर/i.test(lower)) return '💧';
  if (/maid|कामवाली|झाडू/i.test(lower)) return '🧹';
  if (/cook|खाना|रसोइये/i.test(lower)) return '🍳';
  if (/medicine|bp|दवा/i.test(lower)) return '💊';
  if (/vitamin|d3|धूप/i.test(lower)) return '☀️';
  if (/ott|netflix|prime|hotstar|टीवी|सब्सक्रिप्शन/i.test(lower)) return '📺';
  if (/gym|member|जिम|कसरत/i.test(lower)) return '💪';
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

export function parseTaskInput(text: string, lang: 'en' | 'hi' = 'en'): ParsedTaskInput {
  const amountMatch = text.match(/₹\s?([\d,]+)/);
  const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : undefined;
  const reminderTime = parseReminderTime(text);

  let freqPart = 'Every month';
  const everyMatch = text.match(/\bevery\b[\s\S]*/i) || text.match(/हर[\s\S]*/);
  if (everyMatch) {
    freqPart = everyMatch[0].trim();
  } else if (/daily|हर दिन/i.test(text)) {
    freqPart = 'Every day';
  }

  const recurrence = parseFrequencyLabel(freqPart);
  const frequencyLabel = freqPart.charAt(0).toUpperCase() + freqPart.slice(1);

  let cleanTitleText = text.replace(/₹\s?[\d,]+/g, '');
  cleanTitleText = cleanTitleText.replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '');
  cleanTitleText = cleanTitleText.replace(/(?:सुबह|शाम|रात|दोपहर)?\s*\d{1,2}(?::\d{2})?\s*बजे/g, '');

  let title = cleanTitleText.split(/\bevery\b|हर/i)[0].trim();
  title = title.replace(/^[\s,.\-—:]+|[\s,.\-—:]+$/g, '').trim();

  if (!title) title = text.trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);

  const category = guessCategory(text);

  return {
    title: title || (lang === 'hi' ? 'नया कार्य' : 'New recurring task'),
    frequencyLabel,
    recurrence,
    amount,
    category,
    reminderTime,
    icon: guessIcon(text),
  };
}
