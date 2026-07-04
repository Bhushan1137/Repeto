import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, Card, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { Colors, Radius, Typography } from '@/constants/theme';

export default function TermsScreen() {
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
        title={lang === 'hi' ? 'सेवा की शर्तें' : 'Terms of Service'}
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
                  <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
                  <Text style={styles.bodyText}>
                    By creating an account or accessing the Repeato application, you agree to comply with and be bound by these Terms of Service. If you do not agree, you must immediately cease using the app.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. Account Usage & Responsibility</Text>
                  <Text style={styles.bodyText}>
                    • You are responsible for safeguarding your Google account details used to log in.
                  </Text>
                  <Text style={styles.bodyText}>
                    • You are solely responsible for any activity that occurs under your profile credentials, including household invites and task additions.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. Acceptable Use & Collaboration</Text>
                  <Text style={styles.bodyText}>
                    • You agree to use the household sharing features respectfully. You must not send spam invites, modify another user's private settings, or post inappropriate content in task notes.
                  </Text>
                  <Text style={styles.bodyText}>
                    • Repeato reserves the right to suspend accounts that engage in abusive or malicious behavior.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. Disclaimer & Limitations</Text>
                  <Text style={styles.bodyText}>
                    Repeato is provided "as is" and "as available". We do not guarantee that the app will always be error-free or uninterrupted. We are not liable for any missed tasks, scheduling conflicts, database syncing delay, or financial losses resulting from task tracking.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. Modifying Terms</Text>
                  <Text style={styles.bodyText}>
                    We may update these terms occasionally. Your continued use of Repeato after changes are posted constitutes acceptance of the modified Terms of Service.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. Legal Inquiries</Text>
                  <Text style={styles.bodyText}>
                    For any questions regarding these terms, please contact us at:
                  </Text>
                  <Text style={styles.contactEmail}>✉ support@repeato.app</Text>
                </Card.Content>
              </Card>
            </>
          ) : (
            <>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. शर्तों की स्वीकृति</Text>
                  <Text style={styles.bodyText}>
                    Repeato एप्लिकेशन में खाता बनाकर या उसका उपयोग करके, आप इन सेवा की शर्तों का पालन करने और उनसे बाध्य होने के लिए सहमत होते हैं। यदि आप असहमत हैं, तो कृपया ऐप का उपयोग बंद कर दें।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. खाते का उपयोग और जिम्मेदारी</Text>
                  <Text style={styles.bodyText}>
                    • आप अपने Google खाते के विवरण की सुरक्षा के लिए स्वयं जिम्मेदार हैं।
                  </Text>
                  <Text style={styles.bodyText}>
                    • आपके प्रोफ़ाइल क्रेडेंशियल के तहत होने वाली किसी भी गतिविधि के लिए आप पूरी तरह उत्तरदायी हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. स्वीकार्य उपयोग और सहयोग</Text>
                  <Text style={styles.bodyText}>
                    • आप परिवार साझाकरण सुविधाओं का उपयोग सम्मानपूर्वक करने के लिए सहमत हैं। गलत या अनुचित कंटेंट डालना प्रतिबंधित है।
                  </Text>
                  <Text style={styles.bodyText}>
                    • किसी भी अनुचित या दुर्व्यवहार वाले व्यवहार के मामले में Repeato खाते को निलंबित करने का अधिकार सुरक्षित रखता है।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. अस्वीकरण और सीमाएं</Text>
                  <Text style={styles.bodyText}>
                    Repeato "जैसा है" और "जैसी उपलब्धता" के आधार पर प्रदान किया जाता है। हम किसी भी छूटे हुए कार्यों, समय-सारणी के टकराव, या वित्तीय नुकसान के लिए उत्तरदायी नहीं हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. शर्तों में संशोधन</Text>
                  <Text style={styles.bodyText}>
                    हम समय-समय पर इन शर्तों को बदल सकते हैं। अपडेट की गई शर्तों की घोषणा के बाद ऐप का उपयोग जारी रखना आपकी स्वीकृति माना जाएगा।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. कानूनी पूछताछ</Text>
                  <Text style={styles.bodyText}>
                    इन शर्तों के बारे में किसी भी प्रश्न के लिए, कृपया हमसे यहाँ संपर्क करें:
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
