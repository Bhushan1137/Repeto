import type { CategoryKey } from '@/types';

export interface TaskPreset {
  titleEn: string;
  titleHi: string;
  freqEn: string;
  freqHi: string;
  amount?: number;
  finance?: boolean;
  icon?: string;
}

export const PRESETS: Record<CategoryKey, TaskPreset[]> = {
  bills: [
    { titleEn: 'Pay rent', titleHi: 'किराया भुगतान', freqEn: 'Every 5th of month', freqHi: 'हर महीने की 5 तारीख', amount: 18000, finance: true, icon: '🏠' },
    { titleEn: 'Credit card bill', titleHi: 'क्रेडिट कार्ड बिल', freqEn: 'Every 3rd of month', freqHi: 'हर महीने की 3 तारीख', finance: true, icon: '💳' },
    { titleEn: 'Electricity Bill', titleHi: 'बिजली बिल', freqEn: 'Every month', freqHi: 'हर महीने', finance: true, icon: '⚡' },
    { titleEn: 'Water Bill', titleHi: 'पानी का बिल', freqEn: 'Every 2 months', freqHi: 'हर 2 महीने', finance: true, icon: '💧' },
    { titleEn: 'Gas Bill', titleHi: 'गैस बिल', freqEn: 'Every month', freqHi: 'हर महीने', finance: true, icon: '🔥' },
    { titleEn: 'Internet Bill', titleHi: 'इंटरनेट बिल', freqEn: 'Every month', freqHi: 'हर महीने', finance: true, icon: '📶' },
    { titleEn: 'Mobile Recharge', titleHi: 'मोबाइल रिचार्ज', freqEn: 'Every 28 days', freqHi: 'हर 28 दिन', finance: true, icon: '📱' },
    { titleEn: 'Home Loan EMI', titleHi: 'होम लोन ईएमआई', freqEn: 'Every 10th of month', freqHi: 'हर महीने की 10 तारीख', finance: true, icon: '🏠' },
    { titleEn: 'Car Loan EMI', titleHi: 'कार लोन ईएमआई', freqEn: 'Every 7th of month', freqHi: 'हर महीने की 7 तारीख', finance: true, icon: '🚗' },
    { titleEn: 'Personal Loan EMI', titleHi: 'व्यक्तिगत ऋण ईएमआई', freqEn: 'Every 5th of month', freqHi: 'हर महीने की 5 तारीख', finance: true, icon: '💸' },
    { titleEn: 'Society Maintenance', titleHi: 'सोसाइटी रखरखाव', freqEn: 'Every 3 months', freqHi: 'हर 3 महीने', finance: true, icon: '🏢' },
  ],
  finance: [
    { titleEn: 'Monthly Savings', titleHi: 'मासिक बचत', freqEn: 'Every month', freqHi: 'हर महीने', amount: 5000, finance: true, icon: '💰' },
    { titleEn: 'SIP investment', titleHi: 'SIP निवेश', freqEn: 'Every 5th of month', freqHi: 'हर महीने की 5 तारीख', amount: 5000, finance: true, icon: '📈' },
    { titleEn: 'Recurring Deposit (RD)', titleHi: 'आवर्ती जमा', freqEn: 'Every month', freqHi: 'हर महीने', amount: 2000, finance: true, icon: '🐷' },
    { titleEn: 'Fixed Deposit Renewal', titleHi: 'एफडी नवीनीकरण', freqEn: 'Every year', freqHi: 'हर साल', icon: '📝' },
    { titleEn: 'PPF Contribution', titleHi: 'पीपीएफ योगदान', freqEn: 'Every year', freqHi: 'हर साल', amount: 15000, finance: true, icon: '📄' },
    { titleEn: 'NPS Contribution', titleHi: 'एनपीएस योगदान', freqEn: 'Every year', freqHi: 'हर साल', icon: '💼' },
    { titleEn: 'Income Tax Filing', titleHi: 'आयकर फाइलिंग', freqEn: 'Every year', freqHi: 'हर साल', icon: '📁' },
    { titleEn: 'Advance Tax Payment', titleHi: 'अग्रिम कर भुगतान', freqEn: 'Every 3 months', freqHi: 'हर 3 महीने', finance: true, icon: '🏛️' },
  ],
  subs: [
    { titleEn: 'Netflix subscription', titleHi: 'नेटफ्लिक्स सब्सक्रिप्शन', freqEn: 'Every month', freqHi: 'हर महीने', amount: 499, finance: true, icon: '📺' },
    { titleEn: 'Spotify Premium', titleHi: 'स्पॉटिफाई प्रीमियम', freqEn: 'Every month', freqHi: 'हर महीने', amount: 119, finance: true, icon: '🎵' },
    { titleEn: 'Amazon Prime', titleHi: 'अमेज़न प्राइम', freqEn: 'Every year', freqHi: 'हर साल', amount: 1499, finance: true, icon: '📦' },
    { titleEn: 'Disney+ Hotstar', titleHi: 'हॉटस्टार सब्सक्रिप्शन', freqEn: 'Every year', freqHi: 'हर साल', amount: 899, finance: true, icon: '🎬' },
    { titleEn: 'YouTube Premium', titleHi: 'यूट्यूब प्रीमियम', freqEn: 'Every month', freqHi: 'हर महीने', amount: 129, finance: true, icon: '▶️' },
    { titleEn: 'Apple Music', titleHi: 'एप्पल म्यूजिक', freqEn: 'Every month', freqHi: 'हर महीने', amount: 99, finance: true, icon: '🍎' },
    { titleEn: 'Newspaper subscription', titleHi: 'समाचार पत्र सदस्यता', freqEn: 'Every month', freqHi: 'हर महीने', amount: 150, finance: true, icon: '📰' },
    { titleEn: 'Cloud Storage Plan', titleHi: 'क्लाउड स्टोरेज', freqEn: 'Every month', freqHi: 'हर महीने', amount: 130, finance: true, icon: '☁️' },
    { titleEn: 'Gym membership', titleHi: 'जिम मेंबरशिप', freqEn: 'Every month', freqHi: 'हर महीने', amount: 1200, finance: true, icon: '💪' },
  ],
  home: [
    { titleEn: 'Water Bill', titleHi: 'पानी का बिल', freqEn: 'Every 2 months', freqHi: 'हर 2 महीने', finance: true, icon: '💧' },
    { titleEn: 'Electricity Bill', titleHi: 'बिजली बिल', freqEn: 'Every month', freqHi: 'हर महीने', finance: true, icon: '⚡' },
    { titleEn: 'Gas Bill', titleHi: 'गैस बिल', freqEn: 'Every month', freqHi: 'हर महीने', finance: true, icon: '🔥' },
    { titleEn: 'Internet Bill', titleHi: 'इंटरनेट बिल', freqEn: 'Every month', freqHi: 'हर महीने', finance: true, icon: '📶' },
    { titleEn: 'DTH/Cable TV', titleHi: 'केबल टीवी', freqEn: 'Every month', freqHi: 'हर महीने', finance: true, icon: '📡' },
    { titleEn: 'Society Maintenance', titleHi: 'सोसाइटी रखरखाव', freqEn: 'Every month', freqHi: 'हर महीने', finance: true, icon: '🏢' },
    { titleEn: 'Pest Control', titleHi: 'कीट नियंत्रण', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '🐜' },
    { titleEn: 'Water Filter Service', titleHi: 'वॉटर फिल्टर सर्विस', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '💧' },
  ],
  help: [
    { titleEn: "Pay maid's salary", titleHi: 'नौकरानी का वेतन', freqEn: 'Every 1st of month', freqHi: 'हर महीने की 1 तारीख', amount: 3500, finance: true, icon: '🧹' },
    { titleEn: "Pay cook's salary", titleHi: 'रसोइये का वेतन', freqEn: 'Every 1st of month', freqHi: 'हर महीने की 1 तारीख', amount: 4000, finance: true, icon: '🍳' },
    { titleEn: 'Driver Salary', titleHi: 'ड्राइवर वेतन', freqEn: 'Every 1st of month', freqHi: 'हर महीने की 1 तारीख', amount: 15000, finance: true, icon: '🚗' },
    { titleEn: 'Cleaner Payment', titleHi: 'सफाईवाला भुगतान', freqEn: 'Every month', freqHi: 'हर महीने', amount: 500, finance: true, icon: '🧹' },
    { titleEn: 'Laundry Service', titleHi: 'लॉन्ड्री सेवा', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '🧺' },
  ],
  vehicle: [
    { titleEn: 'Fuel refill', titleHi: 'ईंधन रिफिल', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '⛽' },
    { titleEn: 'Vehicle Service', titleHi: 'वाहन सेवा', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '🔧' },
    { titleEn: 'Bike insurance renewal', titleHi: 'बाइक बीमा नवीनीकरण', freqEn: 'Every 12 months', freqHi: 'हर 12 महीने', icon: '🏍️' },
    { titleEn: 'PUC certificate', titleHi: 'PUC प्रमाणपत्र', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '📄' },
    { titleEn: 'Car Wash', titleHi: 'कार वॉश', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '🧼' },
    { titleEn: 'Tyre Check', titleHi: 'टायर चेक', freqEn: 'Every month', freqHi: 'हर महीने', icon: '🚗' },
    { titleEn: 'Driving Licence Renewal', titleHi: 'ड्राइविंग लाइसेंस नवीनीकरण', freqEn: 'Every 10 years', freqHi: 'हर 10 साल', icon: '🪪' },
  ],
  health: [
    { titleEn: 'Doctor Check-up', titleHi: 'डॉक्टर से जांच', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '🩺' },
    { titleEn: 'Dental Check-up', titleHi: 'दंत चिकित्सा जांच', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '🦷' },
    { titleEn: 'Eye Check-up', titleHi: 'आँखों की जाँच', freqEn: 'Every year', freqHi: 'हर साल', icon: '👓' },
    { titleEn: 'Health Check-up', titleHi: 'स्वास्थ्य जांच', freqEn: 'Every year', freqHi: 'हर साल', icon: '🏥' },
    { titleEn: 'Blood Test', titleHi: 'रक्त परीक्षण', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '🩸' },
    { titleEn: 'Water Reminder', titleHi: 'पानी पीने की याद', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🥤' },
    { titleEn: 'Exercise Reminder', titleHi: 'कसरत याद दिलाएं', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🏃' },
  ],
  medicines: [
    { titleEn: 'Daily Medicines', titleHi: 'दैनिक दवाएं', freqEn: 'Every day', freqHi: 'हर दिन', icon: '💊' },
    { titleEn: 'Vitamin Supplements', titleHi: 'विटामिन पूरक', freqEn: 'Every day', freqHi: 'हर दिन', icon: '💊' },
    { titleEn: 'Refill Medicines', titleHi: 'दवा रिफिल', freqEn: 'Every 30 days', freqHi: 'हर 30 दिन', icon: '💊' },
    { titleEn: 'Prescription Renewal', titleHi: 'पर्चे का नवीनीकरण', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '📄' },
  ],
  personal: [
    { titleEn: 'Salon / haircut', titleHi: 'सैलून / हेयरकट', freqEn: 'Every month', freqHi: 'हर महीने', icon: '💇' },
    { titleEn: 'Beard Trim', titleHi: 'दाढ़ी ट्रिम', freqEn: 'Every 2 weeks', freqHi: 'हर 2 सप्ताह', icon: '🪒' },
    { titleEn: 'Salon Visit', titleHi: 'सैलून विजिट', freqEn: 'Every month', freqHi: 'हर महीने', icon: '💆' },
    { titleEn: 'Skin Care', titleHi: 'त्वचा की देखभाल', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🧴' },
    { titleEn: 'Nail Care', titleHi: 'नाखूनों की देखभाल', freqEn: 'Every 2 weeks', freqHi: 'हर 2 सप्ताह', icon: '💅' },
  ],
  education: [
    { titleEn: 'Tuition Fee', titleHi: 'ट्यूशन फीस', freqEn: 'Every month', freqHi: 'हर महीने', amount: 2000, finance: true, icon: '📝' },
    { titleEn: 'Exam Registration', titleHi: 'परीक्षा पंजीकरण', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '📝' },
    { titleEn: 'Assignment Reminder', titleHi: 'असाइनमेंट अनुस्मारक', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '📚' },
    { titleEn: 'Course Renewal', titleHi: 'पाठ्यक्रम नवीनीकरण', freqEn: 'Every year', freqHi: 'हर साल', icon: '💻' },
    { titleEn: 'Practice Session', titleHi: 'अभ्यास सत्र', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🎹' },
  ],
  kids: [
    { titleEn: 'Birthday Reminder', titleHi: 'जन्मदिन की याद', freqEn: 'Every year', freqHi: 'हर साल', icon: '🎂' },
    { titleEn: 'Anniversary Reminder', titleHi: 'वर्षगांठ की याद', freqEn: 'Every year', freqHi: 'हर साल', icon: '🎉' },
    { titleEn: 'Family Time', titleHi: 'पारिवारिक समय', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '👨‍👩‍👧‍👦' },
    { titleEn: 'Parent Health Check-up', titleHi: 'माता-पिता की स्वास्थ्य जांच', freqEn: 'Every year', freqHi: 'हर साल', icon: '🩺' },
    { titleEn: 'School Fee', titleHi: 'स्कूल की फीस', freqEn: 'Every 3 months', freqHi: 'हर 3 महीने', amount: 8500, finance: true, icon: '🏫' },
  ],
  pets: [
    { titleEn: 'Feed Pet', titleHi: 'पालतू को खाना खिलाएं', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🐾' },
    { titleEn: 'Vet Visit', titleHi: 'पशु चिकित्सक के पास जाएं', freqEn: 'Every 6 months', freqHi: 'हर 6 महीने', icon: '🩺' },
    { titleEn: 'Vaccination', titleHi: 'टीकाकरण', freqEn: 'Every year', freqHi: 'हर साल', icon: '💉' },
    { titleEn: 'Grooming', titleHi: 'संवारना', freqEn: 'Every month', freqHi: 'हर महीने', icon: '🛁' },
    { titleEn: 'Flea Treatment', titleHi: 'पिस्सू उपचार', freqEn: 'Every month', freqHi: 'हर महीने', icon: '🧴' },
  ],
  festival: [
    { titleEn: 'Diwali Preparation', titleHi: 'दिवाली की तैयारी', freqEn: 'Every year', freqHi: 'हर साल', icon: '🪔' },
    { titleEn: 'Ganesh Festival', titleHi: 'गणेश उत्सव', freqEn: 'Every year', freqHi: 'हर साल', icon: '🌺' },
    { titleEn: 'Christmas', titleHi: 'क्रिसमस', freqEn: 'Every year', freqHi: 'हर साल', icon: '🎄' },
    { titleEn: 'Eid', titleHi: 'ईद', freqEn: 'Every year', freqHi: 'हर साल', icon: '🌙' },
    { titleEn: 'Raksha Bandhan', titleHi: 'रक्षा बंधन', freqEn: 'Every year', freqHi: 'हर साल', icon: '🎁' },
    { titleEn: 'Holi', titleHi: 'होली', freqEn: 'Every year', freqHi: 'हर साल', icon: '🎨' },
    { titleEn: 'Navratri', titleHi: 'नवरात्रि', freqEn: 'Every year', freqHi: 'हर साल', icon: '🏮' },
    { titleEn: 'Birthday Celebration', titleHi: 'जन्मदिन समारोह', freqEn: 'Every year', freqHi: 'हर साल', icon: '🎈' },
  ],
  work: [
    { titleEn: 'Team Meeting', titleHi: 'टीम मीटिंग', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '👥' },
    { titleEn: 'Submit Report', titleHi: 'रिपोर्ट जमा करें', freqEn: 'Every month', freqHi: 'हर महीने', icon: '📄' },
    { titleEn: 'Salary Credit Check', titleHi: 'वेतन क्रेडिट चेक', freqEn: 'Every month', freqHi: 'हर महीने', icon: '💼' },
    { titleEn: 'Timesheet', titleHi: 'टाइमशीट', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '⏰' },
    { titleEn: 'Client Follow-up', titleHi: 'क्लाइंट फॉलो-अप', freqEn: 'Every day', freqHi: 'हर दिन', icon: '📞' },
    { titleEn: 'Project Review', titleHi: 'परियोजना समीक्षा', freqEn: 'Every month', freqHi: 'हर महीने', icon: '📊' },
  ],
  shopping: [
    { titleEn: 'Monthly Grocery', titleHi: 'मासिक किराना', freqEn: 'Every month', freqHi: 'हर महीने', icon: '🛒' },
    { titleEn: 'Vegetables', titleHi: 'सब्जियाँ', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '🥦' },
    { titleEn: 'Fruits', titleHi: 'फल', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '🍎' },
    { titleEn: 'Household Essentials', titleHi: 'घरेलू आवश्यक वस्तुएं', freqEn: 'Every month', freqHi: 'हर महीने', icon: '🧻' },
    { titleEn: 'Pharmacy Shopping', titleHi: 'फार्मेसी खरीदारी', freqEn: 'Every month', freqHi: 'हर महीने', icon: '💊' },
  ],
  fitness: [
    { titleEn: 'Gym', titleHi: 'जिम', freqEn: 'Every day', freqHi: 'हर दिन', icon: '💪' },
    { titleEn: 'Yoga', titleHi: 'योग', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🧘' },
    { titleEn: 'Running', titleHi: 'दौड़ना', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🏃' },
    { titleEn: 'Walking', titleHi: 'चलना', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🚶' },
    { titleEn: 'Cycling', titleHi: 'साइकिल चलाना', freqEn: 'Every week', freqHi: 'हर सप्ताह', icon: '🚴' },
    { titleEn: 'Stretching', titleHi: 'स्ट्रेचिंग', freqEn: 'Every day', freqHi: 'हर दिन', icon: '🙆' },
  ],
};

export const SAMPLE_CONTACTS = [
  { name: 'Aman', phone: '+919876543210', color: '#3E7C6A' },
  { name: 'Priya', phone: '+919876543211', color: '#C1502E' },
  { name: 'Maa', phone: '+919876543212', color: '#E8A33D' },
];
