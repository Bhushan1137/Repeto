import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { Colors, Radius, Typography } from '@/constants/theme';
import { Button } from '@/components/Button';

export default function PrivacyScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  return (
    <ScreenShell title={lang === 'hi' ? 'गोपनीयता नीति' : 'Privacy Policy'}>
      <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Header Card */}
          <Card style={styles.headerCard} mode="elevated">
            <Card.Content>
              <Text style={styles.headerTitle}>
                {lang === 'hi' ? 'आपकी गोपनीयता और सुरक्षा हमारी प्राथमिकता है' : 'Your Privacy & Peace of Mind Come First'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {lang === 'hi'
                  ? 'Repeto को सरल, सुरक्षित और आपके भरोसे के योग्य बनाने के लिए हम आपका डेटा कैसे संभालते हैं, यहाँ जानें।'
                  : 'A simple, friendly guide on how Repeto keeps your reminders, routines, and family data safe and private.'}
              </Text>

              <SegmentedButtons
                value={lang}
                onValueChange={(val) => setLang(val as 'en' | 'hi')}
                buttons={[
                  { value: 'en', label: 'English' },
                  { value: 'hi', label: 'हिन्दी' },
                ]}
                style={styles.segmentedBtn}
                theme={{ colors: { secondaryContainer: Colors.marigoldLight } }}
              />
            </Card.Content>
          </Card>

          {lang === 'en' ? (
            <View style={styles.contentSection}>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. Welcome & Our Promise</Text>
                  <Text style={styles.bodyText}>
                    Welcome to Repeto! We designed this app to make remembering rent, bills, medicines, and chores easy and stress-free for you and your family.
                  </Text>
                  <Text style={styles.bodyText}>
                    We believe privacy policies should be easy to read and understand, without confusing legal talk. Our core promise is simple: your routines and notes belong to you. We do not sell your personal data, we do not show advertisements, and we only collect what is strictly necessary to run your reminders reliably.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. What Information Repeto Collects</Text>
                  <Text style={styles.bodyText}>
                    To provide you with automatic alarms and real-time syncing, we collect the following details:
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>Your Account Profile:</Text> When you sign in using your Google account or email, we receive your name, email address, and profile photo.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>Routines & Reminders:</Text> The tasks you create (such as &quot;Pay Electricity Bill&quot; or &quot;Daily Vitamin&quot;), reminder schedules, optional bill amounts, and completion history.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>Household Collaboration:</Text> If you join or create a shared household, the household name, member display names, and tasks shared within that household.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>Device Preferences:</Text> Your chosen app language (English or Hindi) and your notification permission status.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
                  <Text style={styles.bodyText}>
                    We use your information strictly for everyday app features:
                  </Text>
                  <Text style={styles.bulletText}>• Triggering timely reminder alarms on your device before tasks are due.</Text>
                  <Text style={styles.bulletText}>• Syncing your routine updates in real-time across your phone and devices.</Text>
                  <Text style={styles.bulletText}>• Displaying shared chores and bill payments to members of your household.</Text>
                  <Text style={styles.bulletText}>• Allowing you to restore your tasks if you switch or reinstall phones.</Text>
                  <Text style={styles.bodyText}>
                    We never use your routines or personal information for tracking, profiling, or targeted advertising.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. Safe Storage & Third-Party Infrastructure</Text>
                  <Text style={styles.bodyText}>
                    Your information is stored locally on your device via secure SQLite and backed up in real-time to Google Cloud Firebase servers (Firestore and Firebase Authentication). Google Firebase uses modern, industry-standard encryption in transit (HTTPS/TLS) and at rest.
                  </Text>
                  <Text style={styles.bodyText}>
                    We do not share your details with any marketing companies or data brokers.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. Account Deletion & Data Rights (Google Play Compliant)</Text>
                  <Text style={styles.bodyText}>
                    You have complete control over your data at all times:
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>In-App Account Deletion:</Text> You can delete your account directly inside the app at any time by navigating to <Text style={styles.boldText}>Profile → Account Actions → Delete Account</Text>.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>30-Day Recovery Grace Period:</Text> If you accidentally delete your account, you have a 30-day window to restore your routines by simply signing in again with your Google account.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>Permanent Data Wipe (&quot;Start Fresh&quot;):</Text> If you prefer immediate permanent erasure, selecting &quot;Start Fresh&quot; on the recovery screen completely wipes all tasks, reminders, notifications, and profile details from our cloud database and local device storage.
                  </Text>
                  <Text style={styles.bulletText}>
                    • You can also reach out to us anytime via the in-app Help & Support section to request immediate manual assistance with account or data deletion.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. Device Permissions</Text>
                  <Text style={styles.bodyText}>
                    Repeto requests minimal device permissions:
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>Camera Permission:</Text> Used strictly and solely to scan QR codes for joining or inviting family to a shared household. Camera frames are processed on-device in real-time. Repeto never captures, records, saves, or uploads photos or videos.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>Notifications & Exact Alarms:</Text> To alert you at the exact time a recurring task or routine is due. You can turn this off anytime in your phone settings.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>7. Need Help or Have Questions?</Text>
                  <Text style={styles.bodyText}>
                    If you have questions about your privacy, data, or need assistance, our support team is available directly inside the app:
                  </Text>
                  <Button
                    title="Open Help & Support"
                    variant="primary"
                    onPress={() => router.push('/help-support')}
                    style={{ marginTop: 10 }}
                  />
                  <Text style={styles.dateText}>Last updated: September 2026 • Effective immediately</Text>
                </Card.Content>
              </Card>
            </View>
          ) : (
            <View style={styles.contentSection}>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. स्वागत और हमारा वादा</Text>
                  <Text style={styles.bodyText}>
                    Repeto में आपका स्वागत है! हमने इस ऐप को आपके और आपके परिवार के लिए बिल, दवाइयाँ और दैनिक कार्य याद रखना आसान और तनावमुक्त बनाने के लिए डिज़ाइन किया है।
                  </Text>
                  <Text style={styles.bodyText}>
                    हमारा वादा सरल है: आपका डेटा केवल आपका है। हम व्यक्तिगत जानकारी नहीं बेचते, कोई विज्ञापन नहीं दिखाते, और केवल वही डेटा एकत्र करते हैं जो आपके रूटीन को सुचारू रखने के लिए आवश्यक है।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. हम कौन सी जानकारी एकत्र करते हैं</Text>
                  <Text style={styles.bodyText}>
                    अलार्म और रीयल-टाइम सिंक प्रदान करने के लिए हम निम्नलिखित जानकारी एकत्र करते हैं:
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>खाता प्रोफ़ाइल:</Text> Google साइन-इन या ईमेल से लॉगिन करने पर आपका नाम, ईमेल और प्रोफ़ाइल फ़ोटो।
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>टास्क और रिमाइंडर:</Text> आपके द्वारा बनाए गए कार्य, नियत तारीखें, पुनरावृत्ति समय और पूर्णता का इतिहास।
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>घर (Household) सहयोग:</Text> यदि आप किसी साझा घर में शामिल होते हैं, तो घर का नाम और सदस्यों के बीच साझा कार्य।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. जानकारी का उपयोग</Text>
                  <Text style={styles.bodyText}>
                    हम आपकी जानकारी का उपयोग केवल ऐप के मूल कार्यों के लिए करते हैं:
                  </Text>
                  <Text style={styles.bulletText}>• समय पर रिमाइंडर अलार्म भेजना।</Text>
                  <Text style={styles.bulletText}>• आपके सभी उपकरणों पर टास्क रीयल-टाइम में सिंक करना।</Text>
                  <Text style={styles.bulletText}>• परिवार के सदस्यों के साथ साझा कार्य प्रबंधित करना।</Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. सुरक्षित डेटा स्टोरेज</Text>
                  <Text style={styles.bodyText}>
                    आपकी जानकारी आपके फोन में सुरक्षित रहती है और Google Cloud Firebase के सुरक्षित सर्वरों पर एन्क्रिप्टेड रूप में बैकअप की जाती है। हम किसी भी तीसरे पक्ष की विज्ञापन कंपनी के साथ आपका डेटा साझा नहीं करते।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. खाता हटाने का अधिकार (Google Play अनुरूप)</Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>ऐप में खाता हटाएं:</Text> आप ऐप के अंदर कभी भी <Text style={styles.boldText}>प्रोफ़ाइल → खाता हटाएं</Text> पर जाकर अपना खाता हटा सकते हैं।
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>30 दिनों की रिकवरी विंडो:</Text> यदि आप गलती से खाता हटा देते हैं, तो 30 दिनों के भीतर दोबारा साइन इन करके अपना सारा डेटा वापस ला सकते हैं।
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>स्थायी डेटा मिटाना (&quot;नए सिरे से शुरू करें&quot;):</Text> रिकवरी स्क्रीन पर &quot;नए सिरे से शुरू करें&quot; चुनकर आप अपने सभी टास्क और जानकारी सर्वर से हमेशा के लिए तुरंत मिटा सकते हैं।
                  </Text>
                  <Text style={styles.bulletText}>
                    • आप ऐप के भीतर सहायता केंद्र (Help & Support) के माध्यम से भी डेटा हटाने का अनुरोध कर सकते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. डिवाइस अनुमतियाँ</Text>
                  <Text style={styles.bodyText}>
                    Repeto केवल आवश्यक कार्यक्षमताओं के लिए न्यूनतम अनुमतियों का अनुरोध करता है:
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>कैमरा अनुमति:</Text> केवल साझा घर में शामिल होने के लिए QR कोड स्कैन करने के लिए उपयोग की जाती है। कैमरे से कोई भी फ़ोटो या वीडियो कभी सहेजा या अपलोड नहीं किया जाता।
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.boldText}>सूचनाएं और अलार्म:</Text> आपके नियत कार्यों के समय पर सटीक रिमाइंडर भेजने के लिए। आप इसे फ़ोन सेटिंग्स में कभी भी प्रबंधित कर सकते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>7. सहायता और संपर्क</Text>
                  <Text style={styles.bodyText}>
                    यदि आपका कोई भी सवाल, सुझाव या डेटा से संबंधित प्रश्न है, तो कृपया ऐप के भीतर सहायता केंद्र से संपर्क करें:
                  </Text>
                  <Button
                    title="सहायता केंद्र खोलें"
                    variant="primary"
                    onPress={() => router.push('/help-support')}
                    style={{ marginTop: 10 }}
                  />
                  <Text style={styles.dateText}>अंतिम अपडेट: सितंबर 2026 • तुरंत प्रभावी</Text>
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
  root: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    marginBottom: 16,
  },
  headerTitle: {
    ...Typography.title,
    fontSize: 20,
    color: Colors.ink,
    marginBottom: 6,
  },
  headerSubtitle: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    lineHeight: 20,
    marginBottom: 16,
  },
  segmentedBtn: {
    marginTop: 4,
  },
  contentSection: {
    gap: 14,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  sectionTitle: {
    ...Typography.title,
    fontSize: 16,
    color: Colors.indigo950,
    marginBottom: 8,
  },
  bodyText: {
    ...Typography.bodySm,
    color: Colors.ink,
    lineHeight: 21,
    marginBottom: 8,
  },
  bulletText: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    lineHeight: 21,
    marginBottom: 6,
    paddingLeft: 4,
  },
  boldText: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  dateText: {
    ...Typography.caption,
    color: Colors.inkFaint,
    marginTop: 14,
    textAlign: 'center',
  },
});
