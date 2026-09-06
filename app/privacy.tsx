import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, SegmentedButtons } from 'react-native-paper';
import { ScreenShell } from '@/components/ScreenShell';
import { Colors, Radius, Typography } from '@/constants/theme';

export default function PrivacyScreen() {
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  return (
    <ScreenShell title={lang === 'hi' ? 'गोपनीयता नीति' : 'Privacy Policy'}>
      <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Card style={styles.headerCard} mode="elevated">
            <Card.Content>
              <Text style={styles.headerTitle}>
                {lang === 'hi' ? 'आपकी गोपनीयता हमारी प्राथमिकता है' : 'Your Privacy is Our Priority'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {lang === 'hi'
                  ? 'जानें कि Repeato आपके डेटा को कैसे सुरक्षित और निजी रखता है।'
                  : 'Learn how Repeato protects your data and keeps your recurring tasks private.'}
              </Text>

              <SegmentedButtons
                value={lang}
                onValueChange={(val) => setLang(val as 'en' | 'hi')}
                buttons={[
                  { value: 'en', label: 'English' },
                  { value: 'hi', label: 'हिंदी' },
                ]}
                style={styles.segmentedBtn}
              />
            </Card.Content>
          </Card>

          {lang === 'en' ? (
            <View style={styles.contentSection}>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. Welcome & Introduction</Text>
                  <Text style={styles.bodyText}>
                    Hello and welcome to Repeato! We are absolutely thrilled to have you as part of our community. Your privacy is something we care about deeply, and we want you to feel completely safe and secure while using our app. This policy is written in plain language—without the complicated legal jargon—to help you understand exactly how we handle your information. By using Repeato, you&apos;re placing your trust in us, and we promise to protect your personal details with the utmost care and respect.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. What Information We Gather</Text>
                  <Text style={styles.bodyText}>
                    To make managing your repeating tasks, household bills, and reminders seamless, Repeato collects:
                  </Text>
                  <Text style={styles.bulletText}>• <Text style={styles.boldText}>Google Account Info:</Text> Your name, email address, and profile photo when you sign in via Google.</Text>
                  <Text style={styles.bulletText}>• <Text style={styles.boldText}>Task & Household Data:</Text> Titles, categories, reminder schedules, financial amounts, and activity history that you create inside the app.</Text>
                  <Text style={styles.bulletText}>• <Text style={styles.boldText}>Device Settings:</Text> Your language preference (English or Hindi) and notification settings.</Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
                  <Text style={styles.bodyText}>
                    We use your details strictly to power your experience:
                  </Text>
                  <Text style={styles.bulletText}>• To sync your recurring tasks across your devices in real-time.</Text>
                  <Text style={styles.bulletText}>• To send timely local push notifications for upcoming task due dates.</Text>
                  <Text style={styles.bulletText}>• To allow members of your shared household to see shared task updates and activity feeds.</Text>
                  <Text style={styles.bulletText}>• We NEVER sell your personal information or share it with third-party advertisers.</Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. Information Sharing & Third Parties</Text>
                  <Text style={styles.bodyText}>
                    We share information only in limited, essential circumstances:
                  </Text>
                  <Text style={styles.bulletText}>• <Text style={styles.boldText}>Household Members:</Text> Tasks you assign or share within a household context are visible to authorized members of that household.</Text>
                  <Text style={styles.bulletText}>• <Text style={styles.boldText}>Cloud Infrastructure:</Text> We store backend data securely using Google Firebase (Firestore and Firebase Auth).</Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. Storage, Backups & Safety</Text>
                  <Text style={styles.bodyText}>
                    Your information is securely saved directly on your phone and backed up in real-time to Google&apos;s cloud servers (Firebase Firestore). We use industry-standard encryption and safety measures to ensure that your records are kept private and secure from unauthorized access.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. Your Control & Deletion Rights</Text>
                  <Text style={styles.bodyText}>
                    You are in complete control of your data. You can edit, delete, or archive any task inside the app whenever you want. If you ever decide to leave Repeato and want us to delete your account and erase all your data from our servers permanently, simply send us a friendly message at support@repeato.app. We will process your deletion request immediately, no questions asked.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>7. How to Contact Us</Text>
                  <Text style={styles.bodyText}>
                    We are always here to help! If you have any questions, suggestions, or just want to chat about your privacy, please feel free to reach out to us:
                  </Text>
                  <Text style={styles.contactEmail}>✉ support@repeato.app</Text>
                </Card.Content>
              </Card>
            </View>
          ) : (
            <View style={styles.contentSection}>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. परिचय और स्वागत</Text>
                  <Text style={styles.bodyText}>
                    Repeato में आपका स्वागत है! हम आपको हमारे समुदाय के हिस्से के रूप में पाकर बेहद खुश हैं। आपकी गोपनीयता हमारे लिए बहुत महत्वपूर्ण है, और हम चाहते हैं कि आप हमारे ऐप का उपयोग करते समय पूरी तरह से सुरक्षित महसूस करें। यह नीति सरल भाषा में लिखी गई है ताकि आप आसानी से समझ सकें कि हम आपकी जानकारी का प्रबंधन कैसे करते हैं। Repeato का उपयोग करके, आप हम पर भरोसा कर रहे हैं, और हम आपकी जानकारी को पूरी सुरक्षा और सम्मान के साथ रखने का वादा करते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. जानकारी जो हम एकत्र करते हैं</Text>
                  <Text style={styles.bodyText}>
                    आपके और आपके परिवार के लिए Repeato को सुचारू रूप से चलाने के लिए, हम कुछ बुनियादी जानकारियां एकत्र करते हैं:
                  </Text>
                  <Text style={styles.bodyText}>
                    • **आपकी प्रोफ़ाइल:** जब आप Google खाते से लॉग इन करते हैं, तो हम आपका नाम, ईमेल और प्रोफ़ाइल फ़ोटो प्राप्त करते हैं। यह ऐप में आपकी पहचान करने में मदद करता है।
                  </Text>
                  <Text style={styles.bodyText}>
                    • **आपके कार्य:** हम आपके द्वारा बनाए गए कार्यों को सहेजते हैं, जैसे कि उनके शीर्षक, शेड्यूल, पूरे किए गए कार्य, नोट्स आदि ताकि आपका रूटीन सही रह सके।
                  </Text>
                  <Text style={styles.bodyText}>
                    • **पारिवारिक शेयरिंग:** यदि आप परिवार के साथ कार्य साझा करते हैं, तो हम आपकी गतिविधियों को साझा कोड के माध्यम से एक साथ सिंक करते हैं ताकि परिवार मिलकर काम कर सके।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. डेटा का उपयोग और व्यक्तिगत विज्ञापन सुझाव</Text>
                  <Text style={styles.bodyText}>
                    हम आपकी जानकारी का उपयोग केवल आपके अनुभव को बेहतर बनाने के लिए करते हैं:
                  </Text>
                  <Text style={styles.bodyText}>
                    • **सिंक करना:** आपके कार्यों को आपके सभी उपकरणों और परिवार के सदस्यों के बीच हमेशा अपडेट रखना।
                  </Text>
                  <Text style={styles.bodyText}>
                    • **व्यक्तिगत सुझाव:** हम आपके द्वारा पूरे किए गए कार्यों का विश्लेषण करके आपको उपयोगी सुझाव और विशेष ऑफर दिखाते हैं (जैसे किसी कार्य के पूरा होने के बाद घरेलू आवश्यकताओं के अनुरूप सुझाव)। यह ऐप को आपके लिए अधिक उपयोगी बनाता है।
                  </Text>
                  <Text style={styles.bodyText}>
                    • **रिमाइंडर:** आपको समय पर पुश नोटिफिकेशन भेजना ताकि आप कोई महत्वपूर्ण काम न भूलें।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. हम आपका डेटा कभी नहीं बेचते</Text>
                  <Text style={styles.bodyText}>
                    हम इसे पूरी तरह से स्पष्ट करना चाहते हैं: **हम आपका व्यक्तिगत डेटा या कार्यों की जानकारी किसी भी बाहरी विज्ञापनदाताओं या कंपनियों को कभी नहीं बेचते हैं, न ही साझा करते हैं।** आपका डेटा केवल ऐप को आपके लिए अधिक व्यक्तिगत और उपयोगी बनाने के लिए उपयोग किया जाता है। आपका डेटा पूरी तरह से आपका और सुरक्षित है।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. सुरक्षा और भंडारण</Text>
                  <Text style={styles.bodyText}>
                    आपकी जानकारी आपके फ़ोन पर स्थानीय रूप से और Google Firebase Firestore सर्वर पर वास्तविक समय में सुरक्षित रूप से सहेजी जाती है। हम अनधिकृत पहुंच से आपके डेटा की सुरक्षा के लिए उच्च स्तरीय सुरक्षा तकनीकों का उपयोग करते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. डेटा हटाना और नियंत्रण</Text>
                  <Text style={styles.bodyText}>
                    आप अपने डेटा के पूर्ण नियंत्रण में हैं। आप कभी भी कार्यों को बदल या हटा सकते हैं। यदि आप अपना अकाउंट और सारा डेटा हमेशा के लिए डिलीट करना चाहते हैं, तो हमें support@repeato.app पर एक ईमेल भेजें, हम इसे तुरंत बिना किसी सवाल के हटा देंगे।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>7. संपर्क करें</Text>
                  <Text style={styles.bodyText}>
                    हम हमेशा आपकी मदद के लिए उपलब्ध हैं! यदि आपके पास गोपनीयता से जुड़े कोई प्रश्न हैं, तो कृपया संपर्क करें:
                  </Text>
                  <Text style={styles.contactEmail}>✉ support@repeato.app</Text>
                </Card.Content>
              </Card>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceMuted },
  container: { flex: 1 },
  headerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    margin: 16,
  },
  headerTitle: {
    ...Typography.title,
    fontSize: 18,
    color: Colors.indigo950,
    marginBottom: 4,
    fontFamily: 'Fraunces_700Bold',
  },
  headerSubtitle: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    marginBottom: 12,
  },
  segmentedBtn: {
    marginBottom: 4,
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  bulletText: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    lineHeight: 20,
    marginBottom: 4,
    paddingLeft: 8,
  },
  boldText: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  backBtn: { marginVertical: 0 },
  langSelector: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 1,
  },
  sectionTitle: {
    ...Typography.title,
    fontSize: 15,
    color: Colors.indigo950,
    marginBottom: 8,
    fontFamily: 'Manrope_700Bold',
  },
  bodyText: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    lineHeight: 19,
    marginBottom: 8,
  },
  contactEmail: {
    ...Typography.bodySm,
    color: Colors.marigoldDeep,
    fontFamily: 'Manrope_700Bold',
    marginTop: 4,
  },
});
