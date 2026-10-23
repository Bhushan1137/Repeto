import React, { useRef } from 'react';
import { StyleSheet, View, type ScrollView } from 'react-native';
import { ScreenShell } from '@/components/ScreenShell';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { TERMS_OF_SERVICE_MARKDOWN } from '@/constants/legal/termsOfServiceText';
import { useTranslation } from '@/hooks/useTranslation';

export default function TermsScreen() {
  const { translate } = useTranslation();
  const scrollRef = useRef<ScrollView | null>(null);

  return (
    <ScreenShell
      title={translate('termsOfService')}
      showBack
      scrollRef={scrollRef}
      contentStyle={styles.shellContent}
    >
      <View style={styles.container}>
        <LegalDocumentView
          markdownText={TERMS_OF_SERVICE_MARKDOWN}
          documentTitle="Repeto Terms of Service"
          lastUpdatedText="September 2026"
          testIDPrefix="terms"
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
