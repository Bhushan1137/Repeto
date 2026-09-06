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

  const backButton = (
    <Button
      title={lang === 'hi' ? 'पीछे' : 'Back'}
      variant="ghost"
      style={styles.backBtn}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }}
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
                  <Text style={styles.sectionTitle}>1. Welcome & Acceptance of Terms</Text>
                  <Text style={styles.bodyText}>
                    Hello there! We are absolutely delighted to have you use Repeato. By installing, signing into, or using our app, you are entering into a friendly agreement to follow these simple rules. These rules (which we call our &quot;Terms of Service&quot;) are here to ensure that everyone in our community has a safe, supportive, and wonderful experience. If for any reason you do not agree with these guidelines, we kindly ask that you do not use the application.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. Personal Responsibility & Account Security</Text>
                  <Text style={styles.bodyText}>
                    You are responsible for keeping your account secure. Please make sure that your Google account login details remain private. Any tasks, shared reminders, or notes added under your profile are your responsibility. We design Repeato with top-notch security, but keeping your device safe is a shared effort.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. Respectful Use & Household Collaboration</Text>
                  <Text style={styles.bodyText}>
                    Repeato includes shared household features that let you collaborate with family, flatmates, or colleagues. We ask that all interaction remain respectful. Please do not add harmful, inappropriate, or illegal content to task titles, notes, or household activity logs.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. Data Ownership & Content Rights</Text>
                  <Text style={styles.bodyText}>
                    You retain full ownership of all tasks, notes, and records you input into Repeato. By using our service, you grant us a non-exclusive, worldwide license to host, display, and process your data solely for the purpose of operating and delivering the Repeato service to you and your authorized household members.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. Service Availability & Updates</Text>
                  <Text style={styles.bodyText}>
                    We continuously improve Repeato with new features, speed enhancements, and design polishes. While we aim for 100% uptime, occasional maintenance or cloud updates may happen. We are not liable for any temporary service interruptions or unexpected downtime beyond our reasonable control.
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. Changes to Terms</Text>
                  <Text style={styles.bodyText}>
                    We may update these terms occasionally to reflect new features or legal requirements. When we make material changes, we will update the version inside the app. Continued use of Repeato after changes means you accept the revised terms.
                  </Text>
                </Card.Content>
              </Card>
            </>
          ) : (
            <>
              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>1. सेवा की शर्तों की स्वीकृति</Text>
                  <Text style={styles.bodyText}>
                    नमस्कार! Repeato का उपयोग करने के लिए हम आपका हृदय से आभार व्यक्त करते हैं। हमारे ऐप का उपयोग करके, आप हमारे सरल नियमों का पालन करने के लिए सहमत हो रहे हैं। ये नियम (जिन्हें हम &quot;सेवा की शर्तें&quot; कहते हैं) इसलिए बनाए गए हैं ताकि हमारे समुदाय के प्रत्येक सदस्य का अनुभव सुरक्षित, सहयोगी और शानदार हो। यदि आप किसी भी कारण से इन नियमों से सहमत नहीं हैं, तो हम आपसे अनुरोध करते हैं कि ऐप का उपयोग न करें।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>2. व्यक्तिगत जिम्मेदारी और खाता सुरक्षा</Text>
                  <Text style={styles.bodyText}>
                    आपका खाता आपकी निजी जगह है। चूंकि आप अपने Google खाते के माध्यम से सुरक्षित लॉग इन करते हैं, हम आपसे अनुरोध करते हैं कि अपने खाते को सुरक्षित रखने के लिए आवश्यक कदम उठाएं। आपके खाते के तहत होने वाली सभी गतिविधियों (जैसे नए कार्य जोड़ना या परिवार को आमंत्रित करना) के लिए आप स्वयं जिम्मेदार होंगे।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>3. पारिवारिक शिष्टाचार और नियम</Text>
                  <Text style={styles.bodyText}>
                    Repeato को परिवार के सदस्यों को जोड़ने और मिलकर कार्य करने के लिए बनाया गया है। ऐप को एक सकारात्मक और मैत्रीपूर्ण स्थान बनाए रखने के लिए:
                  </Text>
                  <Text style={styles.bodyText}>
                    • कृपया परिवार के सभी सदस्यों के साथ आदर और सम्मान से व्यवहार करें।
                  </Text>
                  <Text style={styles.bodyText}>
                    • उन लोगों को आमंत्रित न करें जिन्हें आप नहीं जानते हैं।
                  </Text>
                  <Text style={styles.bodyText}>
                    • कार्यों के शीर्षकों या नोट्स में किसी भी प्रकार की अनुचित या अभद्र भाषा का उपयोग न करें।
                  </Text>
                  <Text style={styles.bodyText}>
                    • दुर्व्यवहार या किसी को परेशान करने की स्थिति में हम संबंधित खाते को निलंबित करने का अधिकार रखते हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>4. कार्य डेटा और सुझावों की गोपनीयता</Text>
                  <Text style={styles.bodyText}>
                    आपके अनुभव को व्यक्तिगत और सहायक बनाने के लिए, हम आपके कार्यों की जानकारी सहेजते हैं। इस डेटा का उपयोग आपके ऐप में सुधार करने और आपको उपयोगी सुझाव देने के लिए किया जाता है। हम गारंटी देते हैं कि **हम आपका डेटा कभी किसी को नहीं बेचते हैं**। हालांकि हम डेटा को हमेशा सुरक्षित रखने का पूरा प्रयास करते हैं, फिर भी तकनीकी सीमाओं के कारण होने वाली किसी भी कमी या डेटा विलंब के लिए हम जिम्मेदार नहीं होंगे।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>5. शर्तों में संशोधन</Text>
                  <Text style={styles.bodyText}>
                    जैसे-जैसे Repeato में नए फीचर्स जुड़ेंगे, हमें समय-समय पर इन शर्तों को अपडेट करना पड़ सकता है। नए नियमों की जानकारी हमेशा आपको यहाँ मिल जाएगी। शर्तों में बदलाव के बाद भी ऐप का उपयोग जारी रखने का अर्थ है कि आप नई शर्तों से सहमत हैं।
                  </Text>
                </Card.Content>
              </Card>

              <Card style={styles.sectionCard} mode="elevated">
                <Card.Content>
                  <Text style={styles.sectionTitle}>6. हमसे संपर्क करें</Text>
                  <Text style={styles.bodyText}>
                    यदि आपके पास शर्तों को लेकर कोई प्रश्न या सुझाव हैं, तो कृपया हमसे बेझिझक संपर्क करें:
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
