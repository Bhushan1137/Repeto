import type { CategoryKey } from '@/types';

export interface TaskPreset {
  titleEn: string;
  titleHi: string;
  freqEn: string;
  freqHi: string;
  amount?: number;
  finance?: boolean;
}

export const PRESETS: Record<CategoryKey, TaskPreset[]> = {
  bills: [
    { titleEn: 'Pay rent', titleHi: 'किराया भुगतान', freqEn: 'Every 5th of month', freqHi: 'हर महीने की 5 तारीख', amount: 18000, finance: true },
    { titleEn: 'Credit card bill', titleHi: 'क्रेडिट कार्ड बिल', freqEn: 'Every 3rd of month', freqHi: 'हर महीने की 3 तारीख', finance: true },
  ],
  vehicle: [
    { titleEn: 'Bike insurance renewal', titleHi: 'बाइक बीमा नवीनीकरण', freqEn: 'Every 12 months', freqHi: 'हर 12 महीने' },
    { titleEn: 'PUC certificate', titleHi: 'PUC प्रमाणपत्र', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने' },
  ],
  home: [
    { titleEn: 'Book gas cylinder', titleHi: 'गैस सिलिंडर बुक करें', freqEn: 'Every 30 days', freqHi: 'हर 30 दिन' },
    { titleEn: 'RO filter service', titleHi: 'RO फ़िल्टर सर्विस', freqEn: 'Every 90 days', freqHi: 'हर 90 दिन' },
  ],
  help: [
    { titleEn: "Pay maid's salary", titleHi: 'नौकरानी का वेतन', freqEn: 'Every 1st of month', freqHi: 'हर महीने की 1 तारीख', amount: 3500, finance: true },
    { titleEn: "Pay cook's salary", titleHi: 'रसोइये का वेतन', freqEn: 'Every 1st of month', freqHi: 'हर महीने की 1 तारीख', amount: 4000, finance: true },
  ],
  health: [
    { titleEn: 'Refill BP medicine', titleHi: 'BP दवा रिफिल', freqEn: 'Every 30 days', freqHi: 'हर 30 दिन' },
    { titleEn: 'Take vitamin D', titleHi: 'विटामिन D लें', freqEn: 'Every day', freqHi: 'हर दिन' },
  ],
  subs: [
    { titleEn: 'OTT subscription renewal', titleHi: 'OTT सब्सक्रिप्शन', freqEn: 'Every month', freqHi: 'हर महीने', amount: 499, finance: true },
    { titleEn: 'Gym membership', titleHi: 'जिम मेंबरशिप', freqEn: 'Every month', freqHi: 'हर महीने', amount: 1200, finance: true },
  ],
  festival: [
    { titleEn: 'Order Diwali sweets', titleHi: 'दिवाली मिठाई ऑर्डर', freqEn: 'Every year', freqHi: 'हर साल' },
    { titleEn: 'Buy Rakhi for brother', titleHi: 'भाई के लिए राखी', freqEn: 'Every year', freqHi: 'हर साल' },
  ],
  education: [
    { titleEn: 'School fees', titleHi: 'स्कूल फीस', freqEn: 'Every 10th of month', freqHi: 'हर महीने की 10 तारीख', amount: 8500, finance: true },
    { titleEn: 'Tuition class payment', titleHi: 'ट्यूशन फीस', freqEn: 'Every 1st of month', freqHi: 'हर महीने की 1 तारीख', amount: 2000, finance: true },
  ],
  personal: [
    { titleEn: 'Salon / haircut', titleHi: 'सैलून / हेयरकट', freqEn: 'Every month', freqHi: 'हर महीने' },
    { titleEn: 'Parlour appointment', titleHi: 'पार्लर अपॉइंटमेंट', freqEn: 'Every 45 days', freqHi: 'हर 45 दिन' },
  ],
  pets: [
    { titleEn: 'Buy pet food', titleHi: 'पेट फूड खरीदें', freqEn: 'Every 30 days', freqHi: 'हर 30 दिन' },
    { titleEn: 'Vet check-up', titleHi: 'पशु चिकित्सक जांच', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने' },
  ],
  finance: [
    { titleEn: 'SIP investment', titleHi: 'SIP निवेश', freqEn: 'Every 5th of month', freqHi: 'हर महीने की 5 तारीख', amount: 5000, finance: true },
    { titleEn: 'File ITR', titleHi: 'ITR भरें', freqEn: 'Every year', freqHi: 'हर साल' },
  ],
  kids: [
    { titleEn: 'Swimming class fees', titleHi: 'तैराकी क्लास फीस', freqEn: 'Every month', freqHi: 'हर महीने', amount: 1500, finance: true },
    { titleEn: 'School bus fee', titleHi: 'स्कूल बस फीस', freqEn: 'Every 1st of month', freqHi: 'हर महीने की 1 तारीख', amount: 1200, finance: true },
  ],
};

export const SAMPLE_CONTACTS = [
  { name: 'Aman', phone: '+919876543210', color: '#3E7C6A' },
  { name: 'Priya', phone: '+919876543211', color: '#C1502E' },
  { name: 'Maa', phone: '+919876543212', color: '#E8A33D' },
];
