import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, Card, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { Colors, Radius, Typography } from '@/constants/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  const backButton = (
    <Button
      title={lang === 'hi' ? 'पीछे' : 'Back'}
      variant="ghost"
      style={styles.backBtn}
      onPress={() => router.back()}
    />
  );

  return (
    <View style={styles.root}>
      <ScreenShell
        title={lang === 'hi' ? 'गोपनीयता नीति' : 'Privacy Policy'}
        subtitle="Repeato App"
        headerExtra={backButton}
      >
        <SegmentedButtons
          value={lang}
          onValueChange={(val) => setLang(val as 'en' | 'hi')}
          buttons={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिन्दी' },
          ]}
          style={styles.langSelector}
          theme={{ colors: { secondaryContainer: Colors.marigoldLight } }}
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {lang === 'en' ? (
            <>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. Introduction</Text>
                  <Text style={styles.bodyText}>
                    Welcome to Repeato. We respect your privacy and are committed to protecting any personal data we process. This Privacy Policy describes how we collect, use, and share your information when you use our mobile application.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. Information We Collect</Text>
                  <Text style={styles.bodyText}>
                    • **Account Information:** When you log in with Google, we collect your name, email address, and profile photo URL.
                  </Text>
                  <Text style={styles.bodyText}>
                    • **App Data:** We store your repeating tasks, task titles, scheduling parameters, completion history, completion notes, and streak counts.
                  </Text>
                  <Text style={styles.bodyText}>
                    • **Household Sharing:** If you invite or join a household, we store your unique household code and associate task activities with your profile initials.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. How We Use Your Data</Text>
                  <Text style={styles.bodyText}>
                    We use the collected data to provide the core services of Repeato, including:
                  </Text>
                  <Text style={styles.bodyText}>
                    • Syncing tasks across your devices and with your household members.
                  </Text>
                  <Text style={styles.bodyText}>
                    • Rendering on-time completion statistics and completion feeds.
                  </Text>
                  <Text style={styles.bodyText}>
                    • Triggering on-device push notifications and reminders.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. Storage & Security</Text>
                  <Text style={styles.bodyText}>
                    Your data is stored locally on your device via AsyncStorage and securely backed up to Google Firebase Firestore servers. We implement administrative and technical measures to protect your database entries against unauthorized access.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. Your Rights & Data Deletion</Text>
                  <Text style={styles.bodyText}>
                    You can manage or delete your tasks at any time. If you wish to delete your account and clear all associated cloud data from Firebase Firestore, you can request data deletion by contacting us at support@repeato.app.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. Contact Us</Text>
                  <Text style={styles.bodyText}>
                    If you have questions about this policy, please reach out to us at:
                  </Text>
                  <Text style={styles.contactEmail}>✉ support@repeato.app</Text>
                </Card.Content>
              </Card>
            </>
          ) : (
            <>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. प्रस्तावना</Text>
                  <Text style={styles.bodyText}>
                    Repeato में आपका स्वागत है। हम आपकी गोपनीयता का सम्मान करते हैं और आपके व्यक्तिगत डेटा की सुरक्षा के लिए प्रतिबद्ध हैं। यह गोपनीयता नीति बताती है कि जब आप हमारे मोबाइल एप्लिकेशन का उपयोग करते हैं तो हम आपकी जानकारी को कैसे एकत्र, उपयोग और साझा करते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. जानकारी जो हम एकत्र करते हैं</Text>
                  <Text style={styles.bodyText}>
                    • **खाता जानकारी:** जब आप Google के साथ लॉग इन करते हैं, तो हम आपका नाम, ईमेल पता और प्रोफ़ाइल फ़ोटो URL एकत्र करते हैं।
                  </Text>
                  <Text style={styles.bodyText}>
                    • **ऐप डेटा:** हम आपके दोहराने वाले कार्य, उनके शीर्षक, शेड्यूल, पूरा करने का इतिहास, नोट्स और स्ट्रीक की जानकारी सहेजते हैं।
                  </Text>
                  <Text style={styles.bodyText}>
                    • **पारिवारिक शेयरिंग:** यदि आप परिवार को जोड़ते हैं, तो हम आपके यूनीक कोड और साझा गतिविधियों को आपके प्रोफ़ाइल नाम के साथ सेव करते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. डेटा का उपयोग</Text>
                  <Text style={styles.bodyText}>
                    हम एकत्र किए गए डेटा का उपयोग निम्नलिखित मुख्य सेवाएं प्रदान करने के लिए करते हैं:
                  </Text>
                  <Text style={styles.bodyText}>
                    • आपके डिवाइसों और परिवार के सदस्यों के बीच कार्यों को सिंक करना।
                  </Text>
                  <Text style={styles.bodyText}>
                    • समय पर पूरे किए गए कार्यों की सांख्यिकी और गतिविधि फीड दिखाना।
                  </Text>
                  <Text style={styles.bodyText}>
                    • डिवाइस पर पुश रिमाइंडर और सूचनाएं भेजना।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. भंडारण और सुरक्षा</Text>
                  <Text style={styles.bodyText}>
                    आपका डेटा AsyncStorage के माध्यम से आपके डिवाइस पर लोकल रूप से संग्रहीत किया जाता है और Google Firebase Firestore सर्वर पर सुरक्षित रूप से बैकअप लिया जाता है।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. आपके अधिकार और डेटा हटाना</Text>
                  <Text style={styles.bodyText}>
                    आप अपने कार्यों को कभी भी डिलीट कर सकते हैं। यदि आप अपना अकाउंट और सभी क्लाउड डेटा डिलीट करना चाहते हैं, तो कृपया support@repeato.app पर ईमेल भेजकर अनुरोध करें।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. संपर्क करें</Text>
                  <Text style={styles.bodyText}>
                    इस नीति के बारे में किसी भी प्रश्न के लिए, कृपया हमसे यहाँ संपर्क करें:
                  </Text>
                  <Text style={styles.contactEmail}>✉ support@repeato.app</Text>
                </Card.Content>
              </Card>
            </>
          )}
        </ScrollView>
      </ScreenShell>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceMuted },
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
