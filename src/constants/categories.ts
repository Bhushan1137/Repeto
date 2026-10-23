import type { CategoryKey } from '@/types';

export interface CategoryDef {
  key: CategoryKey;
  labelEn: string;
  labelHi: string;
  icon: string;
  accent: 'clay' | 'teal' | 'marigold';
  group: 'money' | 'home' | 'life';
  hintEn?: string;
  hintHi?: string;
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'bills', labelEn: 'Bills & Loans', labelHi: 'बिल और ऋण', icon: '💳', accent: 'clay', group: 'money', hintEn: 'Rent, Credit Card, Electricity, EMI', hintHi: 'किराया, क्रेडिट कार्ड, बिजली, ईएमआई' },
  { key: 'finance', labelEn: 'Savings & Taxes', labelHi: 'बचत और कर', icon: '💰', accent: 'teal', group: 'money', hintEn: 'Savings, Investments, Income Tax', hintHi: 'बचत, निवेश, आयकर' },
  { key: 'subs', labelEn: 'Subscriptions', labelHi: 'सब्सक्रिप्शन', icon: '📺', accent: 'marigold', group: 'money', hintEn: 'Netflix, Spotify, Newspaper, Apps', hintHi: 'नेटफ्लिक्स, स्पॉटिफाई, अखबार, ऐप्स' },
  { key: 'home', labelEn: 'Home Bills', labelHi: 'घर के बिल', icon: '🏠', accent: 'marigold', group: 'home', hintEn: 'Water, Gas, Internet, Maintenance', hintHi: 'पानी, गैस, इंटरनेट, रखरखाव' },
  { key: 'help', labelEn: 'House Help', labelHi: 'घरेलू सहायता', icon: '🧹', accent: 'clay', group: 'home', hintEn: 'Maid, Cleaner, Cook, Other Help', hintHi: 'कामवाली, सफाईवाला, रसोइया, अन्य' },
  { key: 'vehicle', labelEn: 'Vehicle', labelHi: 'वाहन', icon: '🚗', accent: 'teal', group: 'home', hintEn: 'Fuel, Service, Insurance', hintHi: 'ईंधन, सेवा, बीमा' },
  { key: 'health', labelEn: 'Health', labelHi: 'स्वास्थ्य', icon: '❤️', accent: 'teal', group: 'life', hintEn: 'Medicine, Doctor, Water Reminder', hintHi: 'दवा, डॉक्टर, पानी अनुस्मारक' },
  { key: 'personal', labelEn: 'Grooming', labelHi: 'तैयार होना', icon: '✂️', accent: 'marigold', group: 'life', hintEn: 'Haircut, Salon, Personal Care', hintHi: 'बाल काटना, सैलून, व्यक्तिगत देखभाल' },
  { key: 'education', labelEn: 'Study', labelHi: 'अध्ययन', icon: '🎓', accent: 'clay', group: 'life', hintEn: 'Classes, Exams, Courses', hintHi: 'कक्षाएं, परीक्षाएं, पाठ्यक्रम' },
  { key: 'kids', labelEn: 'Family', labelHi: 'परिवार', icon: '👨\u200d👩\u200d👧', accent: 'marigold', group: 'life', hintEn: 'Birthdays, Anniversaries, Family Time', hintHi: 'जन्मदिन, वर्षगांठ, पारिवारिक समय' },
  { key: 'pets', labelEn: 'Pets', labelHi: 'पालतू जानवर', icon: '🐾', accent: 'teal', group: 'life', hintEn: 'Feeding, Vet, Grooming', hintHi: 'खिलाना, पशु चिकित्सक, संवारना' },
  { key: 'festival', labelEn: 'Festivals', labelHi: 'त्योहार', icon: '🪔', accent: 'marigold', group: 'life', hintEn: 'Festivals, Pujas, Rituals', hintHi: 'त्योहार, पूजा, अनुष्ठान' },
  { key: 'shopping', labelEn: 'Shopping', labelHi: 'खरीदारी', icon: '🛒', accent: 'marigold', group: 'life', hintEn: 'Grocery, Monthly Shopping, Essentials', hintHi: 'किराना, मासिक खरीदारी, आवश्यक वस्तुएं' },
  { key: 'fitness', labelEn: 'Fitness', labelHi: 'फिटनेस', icon: '💪', accent: 'teal', group: 'life', hintEn: 'Gym, Yoga, Walk, Workout', hintHi: 'जिम, योग, चलना, कसरत' },
  { key: 'medicines', labelEn: 'Medicines', labelHi: 'दवाइयाँ', icon: '💊', accent: 'teal', group: 'life', hintEn: 'Daily Medicines, Supplements', hintHi: 'दैनिक दवाएं, पूरक' },
  { key: 'work', labelEn: 'Work', labelHi: 'काम', icon: '💼', accent: 'clay', group: 'money', hintEn: 'Meetings, Reports, Salary', hintHi: 'बैठकें, रिपोर्ट, वेतन' },
  { key: 'supplies', labelEn: 'Daily Supplies & Vendors', labelHi: 'दैनिक आपूर्ति व वेंडर', icon: '🥛', accent: 'marigold', group: 'home', hintEn: 'Milk, Water Jar, Gas Cylinder, Dhobi', hintHi: 'दूध, पानी जार, गैस सिलेंडर, धोबी' },
  { key: 'maintenance', labelEn: 'Home Maintenance & Appliances', labelHi: 'घर रखरखाव व उपकरण', icon: '🔧', accent: 'teal', group: 'home', hintEn: 'AC Service, RO Filter, Chimney, Tank', hintHi: 'एसी सर्विस, आरओ फिल्टर, चिमनी, टंकी' },
  { key: 'documents', labelEn: 'Essential Documents & Mobility', labelHi: 'आवश्यक दस्तावेज़ व गतिशीलता', icon: '🪪', accent: 'clay', group: 'money', hintEn: 'FASTag, Metro Card, PUC, Property Tax', hintHi: 'फास्टैग, मेट्रो कार्ड, पीयूसी, संपत्ति कर' },
  { key: 'gardening', labelEn: 'Plants & Balcony Garden', labelHi: 'पौधे व बालकनी गार्डन', icon: '🪴', accent: 'teal', group: 'life', hintEn: 'Watering, Fertilizer, Trimming, Pest Spray', hintHi: 'पानी देना, खाद, कटाई-छंटाई, कीटनाशक' },
];

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<CategoryKey, CategoryDef>;

export const CATEGORY_GROUPS: { key: CategoryDef['group']; labelEn: string; labelHi: string }[] = [
  { key: 'money', labelEn: 'Finance', labelHi: 'वित्त' },
  { key: 'home', labelEn: 'Home', labelHi: 'घर' },
  { key: 'life', labelEn: 'Lifestyle', labelHi: 'जीवनशैली' },
];
