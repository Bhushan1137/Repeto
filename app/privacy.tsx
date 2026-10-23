import React, { useRef } from 'react';
import { StyleSheet, View, type ScrollView } from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { PRIVACY_POLICY_MARKDOWN } from '@/constants/legal/privacyPolicyText';
import { useTranslation } from '@/hooks/useTranslation';

export default function PrivacyScreen() {
  const { translate } = useTranslation();
  const scrollRef = useRef<ScrollView | null>(null);

  return (
    <ScreenShell
      title={translate('privacyPolicy')}
      showBack
      scrollRef={scrollRef}
      contentStyle={styles.shellContent}
    >
      <View style={styles.container}>
        <LegalDocumentView
          markdownText={PRIVACY_POLICY_MARKDOWN}
          documentTitle="Repeto Privacy Policy"
          lastUpdatedText="September 2026"
          testIDPrefix="privacy"
          scrollRef={scrollRef}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shellContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  container: {
    flex: 1,
  },
});
