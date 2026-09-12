import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { Colors, Radius, Typography } from '@/constants/theme';

export default function TermsScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  return (
    <ScreenShell title={lang === 'hi' ? 'सेवा की शर्तें' : 'Terms of Service'}>
      <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Header Card */}
          <Card style={styles.headerCard} mode="elevated">
            <Card.Content>
              <Text style={styles.headerTitle}>
                {lang === 'hi' ? 'Repeato में आपका स्वागत है' : 'Welcome to Repeato'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {lang === 'hi'
                  ? 'हमारे सरल, मैत्रीपूर्ण और पारदर्शी नियम, जो आपके और आपके परिवार के अनुभव को सुखद और सुरक्षित बनाते हैं।'
                  : 'Simple, friendly, and easy guidelines designed to keep your experience safe, pleasant, and respectful.'}
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
                  <Text style={styles.sectionTitle}>1. Welcome & Acceptance of Terms</Text>
                  <Text style={styles.bodyText}>
                    Hello and welcome to Repeato! We created this application to help individuals, roommates, and families easily manage daily chores, bills, and repeating routines in harmony.
                  </Text>
                  <Text style={styles.bodyText}>
                    By installing, opening, or using Repeato, you agree to these terms in a spirit of mutual trust and respect. We wrote these terms in clear, friendly language so that everyone can easily understand them. If you do not agree with any part of these guidelines, please feel free to discontinue using the application.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. Safe Account Access & Login</Text>
                  <Text style={styles.bodyText}>
                    You can sign in securely with your Google account or email. To keep your information safe, please protect access to your device and login credentials.
                  </Text>
                  <Text style={styles.bodyText}>
                    You are in control of all tasks, notes, and activities created under your account. We use modern encryption and industry-standard security safeguards so your account remains safe and private.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. Respectful Household Collaboration</Text>
                  <Text style={styles.bodyText}>
                    Repeato offers shared spaces where family members and flatmates can share reminders, assign tasks, and split responsibilities together.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>Mutual Respect:</Text> Please keep shared task titles, notes, and activity chats polite, supportive, and kind.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>Trusted Invitations:</Text> Only invite people you know and trust to your household circle.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>Clean Content:</Text> Do not post harmful, abusive, fraudulent, or illegal material.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. Your Data & Content Ownership</Text>
                  <Text style={styles.bodyText}>
                    Everything you create—your tasks, lists, reminders, notes, and completion records—belongs entirely to you.
                  </Text>
                  <Text style={styles.bodyText}>
                    You grant Repeato only the permission needed to sync your data across your devices, generate your scheduled alerts, and share tasks with members of your selected household. We never sell your personal content, and we never use your personal reminders for marketing or advertisement targeting.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. Account Deletion & Your Control (Google Play Compliance)</Text>
                  <Text style={styles.bodyText}>
                    You have total ownership and control over your account at all times. In compliance with Google Play Store User Data & Account Deletion policies, Repeato provides an easy, direct in-app path to delete your account:
                  </Text>
                  <View style={styles.calloutBox}>
                    <Text style={styles.calloutTitle}>How to Delete Your Account In-App:</Text>
                    <Text style={styles.calloutText}>
                      Open the app → Go to <Text style={styles.boldText}>Profile</Text> tab → Scroll to <Text style={styles.boldText}>Account Actions</Text> → Tap <Text style={styles.boldText}>Delete Account</Text>.
                    </Text>
                  </View>
                  <Text style={styles.bodyText}>
                    You can choose between:
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>30-Day Recovery Window:</Text> Deactivate your account with the freedom to restore it within 30 days if you change your mind.
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>Start Fresh / Immediate Wipe:</Text> Permanently and immediately delete all your tasks, routines, and profile data from our servers.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. Service Reliability & Continuous Improvement</Text>
                  <Text style={styles.bodyText}>
                    We work continuously to provide a fast, smooth, and dependable experience. Occasionally, we release updates to add features, improve security, or enhance performance.
                  </Text>
                  <Text style={styles.bodyText}>
                    While we strive for 100% uptime, temporary interruptions may occasionally occur due to device battery-saver settings, network conditions, or cloud maintenance. We work diligently to minimize any downtime and restore services quickly.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>7. Changes to These Terms</Text>
                  <Text style={styles.bodyText}>
                    As Repeato grows and introduces new capabilities, we may periodically update these terms. When changes occur, the updated document will always be accessible here in the app. Continuing to use Repeato after updates indicates your agreement with the updated terms.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>8. Friendly Help & In-App Support</Text>
                  <Text style={styles.bodyText}>
                    We are always here to support you. If you have any questions, feedback, or need assistance regarding these terms or your experience, our team is available right inside the app:
                  </Text>
                  <Button
                    title="Open Help & Support"
                    variant="primary"
                    onPress={() => router.push('/help-support')}
                    style={{ marginTop: 10 }}
                  />
                </Card.Content>
              </Card>
            </View>
          ) : (
            <View style={styles.contentSection}>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. सेवा की शर्तों की स्वीकृति</Text>
                  <Text style={styles.bodyText}>
                    नमस्ते! Repeato में आपका हार्दिक स्वागत है। हमने इस ऐप को इसलिए बनाया है ताकि आप, आपका परिवार और आपके साथी मिलकर बिना किसी तनाव के अपने दैनिक कार्यों, बिलों और आदतों को आसानी से व्यवस्थित रख सकें।
                  </Text>
                  <Text style={styles.bodyText}>
                    ऐप का उपयोग करके आप इन सरल और मित्रवत नियमों का सम्मान करने के लिए सहमत होते हैं। हमने इन नियमों को बिल्कुल सरल और सहज भाषा में लिखा है ताकि हर कोई इन्हें आसानी से समझ सके।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. सुरक्षित खाता और लॉग इन</Text>
                  <Text style={styles.bodyText}>
                    आप अपने Google खाते या ईमेल से सुरक्षित रूप से लॉग इन कर सकते हैं। अपने डेटा को सुरक्षित रखने के लिए अपने फ़ोन और क्रेडेंशियल्स की सुरक्षा का ध्यान रखें।
                  </Text>
                  <Text style={styles.bodyText}>
                    आपके खाते के अंतर्गत बनाए गए सभी कार्यों और नोट्स पर आपका पूर्ण अधिकार और नियंत्रण रहता है।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. पारिवारिक शिष्टाचार और सकारात्मक सहयोग</Text>
                  <Text style={styles.bodyText}>
                    Repeato आपको परिवार और रूममेट्स के साथ कार्य साझा करने की सुविधा देता है। ऐप को एक खुशनुमा और सुरक्षित मंच बनाए रखने के लिए:
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>आपसी सम्मान:</Text> कृपया सभी के साथ आदर, विनम्रता और सकारात्मकता से पेश आएं।
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>विश्वसनीय आमंत्रण:</Text> केवल उन्हीं लोगों को अपने घर (Household) में जोड़ें जिन्हें आप व्यक्तिगत रूप से जानते हैं।
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>सभ्य सामग्री:</Text> किसी भी प्रकार की अनुचित, आपत्तिजनक या भ्रामक भाषा का प्रयोग न करें।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. आपके डेटा और सामग्री पर आपका अधिकार</Text>
                  <Text style={styles.bodyText}>
                    आप जो भी कार्य, नोट्स या सूचियाँ ऐप में जोड़ते हैं, वे पूरी तरह से आपकी अपनी हैं।
                  </Text>
                  <Text style={styles.bodyText}>
                    Repeato केवल आपके डेटा को सुरक्षित रूप से सिंक करने और समय पर सूचनाएं भेजने के लिए इसका उपयोग करता है। हम आपका व्यक्तिगत डेटा कभी किसी को नहीं बेचते और न ही इसका उपयोग विज्ञापनों के लिए करते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. खाता हटाना और पूर्ण स्वतंत्रता (Google Play नीति के अनुसार)</Text>
                  <Text style={styles.bodyText}>
                    Google Play Store की नीतियों के अनुरूप, आपको कभी भी ऐप के भीतर से अपना खाता और डेटा हटाने की पूरी स्वतंत्रता है:
                  </Text>
                  <View style={styles.calloutBox}>
                    <Text style={styles.calloutTitle}>ऐप में खाता कैसे हटाएं:</Text>
                    <Text style={styles.calloutText}>
                      ऐप खोलें → <Text style={styles.boldText}>प्रोफ़ाइल (Profile)</Text> टैब में जाएं → नीचे <Text style={styles.boldText}>Account Actions</Text> में <Text style={styles.boldText}>Delete Account</Text> पर टैप करें।
                    </Text>
                  </View>
                  <Text style={styles.bodyText}>
                    आप अपनी सुविधानुसार चुन सकते हैं:
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>30 दिनों का विकल्प:</Text> खाता निष्क्रिय करें और यदि आपका मन बदलता है तो 30 दिनों के भीतर उसे पुनः सक्रिय करें।
                  </Text>
                  <Text style={styles.bulletText}>
                    • <Text style={styles.bulletBold}>डेटा तुरंत मिटाएं (Start Fresh):</Text> अपने सभी कार्य, इतिहास और प्रोफ़ाइल जानकारी को हमारे सर्वर से हमेशा के लिए स्थायी रूप से हटा दें।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. निरंतर सुधार और सेवा की गुणवत्ता</Text>
                  <Text style={styles.bodyText}>
                    हम Repeato को अधिक तेज़, स्थिर और उपयोगी बनाने के लिए निरंतर काम करते हैं। हम आपको 100% संतोषजनक सेवा देने का हरसंभव प्रयास करते हैं। नेटवर्क समस्याओं या रखरखाव के कारण कभी-कभार आने वाली रुकावटों को हम प्राथमिकता के साथ हल करते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>7. नियमों में संशोधन</Text>
                  <Text style={styles.bodyText}>
                    ऐप में नई सुविधाएं जुड़ने पर हम समय-समय पर इन शर्तों को और बेहतर बना सकते हैं। नए नियमों की जानकारी हमेशा आपको यहाँ मिल जाएगी।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>8. सहायता और संपर्क</Text>
                  <Text style={styles.bodyText}>
                    हम आपकी सहायता के लिए सदैव तत्पर हैं। यदि आपके पास कोई प्रश्न, सुझाव या समस्या है, तो आप ऐप के भीतर सहायता केंद्र से सीधे टिकट बनाकर हमारी टीम से संपर्क कर सकते हैं:
                  </Text>
                  <Button
                    title="सहायता केंद्र खोलें"
                    variant="primary"
                    onPress={() => router.push('/help-support')}
                    style={{ marginTop: 10 }}
                  />
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
    paddingBottom: 48,
  },
  headerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  headerTitle: {
    ...Typography.title,
    fontSize: 18,
    color: Colors.indigo950,
    marginBottom: 6,
    fontFamily: 'Manrope_700Bold',
  },
  headerSubtitle: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    lineHeight: 20,
    marginBottom: 14,
  },
  segmentedBtn: {
    marginTop: 4,
  },
  contentSection: {
    gap: 12,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
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
    lineHeight: 20,
    marginBottom: 8,
  },
  bulletText: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    lineHeight: 20,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletBold: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  boldText: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  calloutBox: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.marigoldDeep,
  },
  calloutTitle: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
    marginBottom: 4,
  },
  calloutText: {
    ...Typography.caption,
    color: Colors.inkSoft,
    lineHeight: 18,
  },
});
