import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  Platform,
  type ScrollView,
} from 'react-native';
import { Text, Card, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { Colors, Radius, Typography } from '@/constants/theme';
import {
  parseLegalMarkdown,
  type LegalBlock,
  type TextSpan,
} from '@/utils/legalParser';

interface LegalDocumentViewProps {
  markdownText: string;
  documentTitle: string;
  lastUpdatedText?: string;
  testIDPrefix?: string;
  scrollRef?: React.RefObject<ScrollView | null>;
}

export function LegalDocumentView({
  markdownText,
  documentTitle,
  lastUpdatedText = 'September 2026',
  testIDPrefix = 'legal',
  scrollRef,
}: LegalDocumentViewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [tocVisible, setTocVisible] = useState(false);

  // Section Y layout coordinates for smooth jumping
  const sectionLayouts = useRef<{ [key: string]: number }>({});

  const sections = useMemo(() => {
    return parseLegalMarkdown(markdownText);
  }, [markdownText]);

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;

    return sections.filter((section) => {
      if (section.title.toLowerCase().includes(q)) return true;
      return section.blocks.some((block) => block.text.toLowerCase().includes(q));
    });
  }, [sections, searchQuery]);

  const handleEmailPress = async (email: string) => {
    try {
      await Linking.openURL(`mailto:${email}`);
    } catch {
      // In case mailto is not supported in environment
    }
  };

  const handleScrollToSection = (sectionId: string) => {
    setTocVisible(false);
    const yCoord = sectionLayouts.current[sectionId];
    if (yCoord !== undefined && scrollRef?.current) {
      scrollRef.current.scrollTo({
        y: Math.max(0, yCoord - 40),
        animated: true,
      });
    }
  };

  const handleBackToTop = () => {
    if (scrollRef?.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const renderInlineSpans = (spans: TextSpan[], keyPrefix: string) => {
    return spans.map((span, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (span.isEmail) {
        return (
          <Text
            key={key}
            style={styles.emailLink}
            onPress={() => handleEmailPress(span.text)}
            accessibilityRole="link"
          >
            {span.text}
          </Text>
        );
      }

      if (span.isCode) {
        return (
          <Text key={key} style={styles.inlineCode}>
            {' '}{span.text}{' '}
          </Text>
        );
      }

      if (span.isBold) {
        return (
          <Text key={key} style={styles.boldText}>
            {span.text}
          </Text>
        );
      }

      return (
        <Text key={key} style={styles.regularText}>
          {span.text}
        </Text>
      );
    });
  };

  const renderBlock = (block: LegalBlock, blockIdx: number, sectionId: string) => {
    const key = `${sectionId}-block-${blockIdx}`;

    switch (block.type) {
      case 'doc_title':
        return null; // Rendered in main header card

      case 'subheading':
        return (
          <View key={key} style={styles.subheadingContainer}>
            <View style={styles.subheadingAccentBar} />
            <Text style={styles.subheadingText}>
              {renderInlineSpans(block.spans, key)}
            </Text>
          </View>
        );

      case 'bullet':
        return (
          <View key={key} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletContent}>
              {renderInlineSpans(block.spans, key)}
            </Text>
          </View>
        );

      case 'numbered':
        return (
          <View key={key} style={styles.numberedRow}>
            <Text style={styles.numberedIndex}>{block.number}.</Text>
            <Text style={styles.numberedContent}>
              {renderInlineSpans(block.spans, key)}
            </Text>
          </View>
        );

      case 'doc_end':
        return (
          <View key={key} style={styles.docEndContainer}>
            <View style={styles.docEndDivider} />
            <Text style={styles.docEndText}>— {block.text} —</Text>
            <View style={styles.docEndDivider} />
          </View>
        );

      case 'paragraph':
      default:
        return (
          <Text key={key} style={styles.bodyParagraph}>
            {renderInlineSpans(block.spans, key)}
          </Text>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Card */}
      <Card style={styles.headerCard} mode="elevated">
        <Card.Content>
          <View style={styles.headerBadgesRow}>
            <View style={styles.officialBadge}>
              <AppIcon name="documents-outline" size={14} color={Colors.indigo950} />
              <Text style={styles.officialBadgeText}>Official Legal Terms</Text>
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>Effective: {lastUpdatedText}</Text>
            </View>
          </View>

          <Text style={styles.documentMainTitle}>{documentTitle}</Text>
          <Text style={styles.documentSubtitle}>
            Full, official document detailing your rights, service usage rules, account privacy, and data policies.
          </Text>

          {/* Quick jump to section button */}
          <View style={styles.actionRow}>
            <Pressable
              style={styles.tocTriggerBtn}
              onPress={() => setTocVisible(true)}
              testID={`${testIDPrefix}-toc-btn`}
            >
              <AppIcon name="bookmark-outline" size={16} color={Colors.indigo950} />
              <Text style={styles.tocTriggerBtnText}>
                Table of Contents ({sections.length} Sections)
              </Text>
              <AppIcon name="chevron-down-outline" size={16} color={Colors.indigo950} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <AppIcon name="search-outline" size={18} color={Colors.inkFaint} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search keyword (e.g. deletion, bills, camera)..."
              placeholderTextColor={Colors.inkFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              testID={`${testIDPrefix}-search-input`}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={8}
                testID={`${testIDPrefix}-clear-search`}
              >
                <AppIcon name="close-circle-outline" size={18} color={Colors.inkSoft} />
              </Pressable>
            )}
          </View>

          {searchQuery.trim().length > 0 && (
            <View style={styles.searchResultBadge}>
              <Text style={styles.searchResultText}>
                Showing {filteredSections.length} of {sections.length} sections matching &quot;{searchQuery}&quot;
              </Text>
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.searchResetLink}>Reset</Text>
              </Pressable>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Render All Sections */}
      {filteredSections.map((section) => {
        const isIntro = section.id === 'intro';
        return (
          <View
            key={section.id}
            onLayout={(e) => {
              sectionLayouts.current[section.id] = e.nativeEvent.layout.y;
            }}
            style={styles.sectionWrapper}
          >
            <Card style={styles.sectionCard} mode="elevated" testID={`${testIDPrefix}-section-${section.id}`}>
              <Card.Content>
                {!isIntro && (
                  <View style={styles.sectionHeaderRow}>
                    {section.sectionNumber !== undefined && (
                      <View style={styles.sectionNumberBadge}>
                        <Text style={styles.sectionNumberText}>§ {section.sectionNumber}</Text>
                      </View>
                    )}
                    <Text style={styles.sectionTitleText}>{section.title}</Text>
                  </View>
                )}

                {section.blocks.map((block, idx) =>
                  renderBlock(block, idx, section.id)
                )}
              </Card.Content>
            </Card>
          </View>
        );
      })}

      {/* Footer Support Card */}
      <Card style={styles.footerCard} mode="elevated">
        <Card.Content>
          <View style={styles.footerHeaderRow}>
            <View style={styles.footerIconCircle}>
              <AppIcon name="alert-circle-outline" size={24} color={Colors.indigo950} />
            </View>
            <View style={styles.footerHeaderTextWrap}>
              <Text style={styles.footerTitle}>Have Questions or Concerns?</Text>
              <Text style={styles.footerSubtitle}>
                Our customer support and privacy team are available to help you with any inquiries.
              </Text>
            </View>
          </View>

          <View style={styles.footerButtonsWrap}>
            <Button
              title="Email Privacy Support"
              variant="primary"
              onPress={() => handleEmailPress('support.repeto@gmail.com')}
              style={styles.footerPrimaryBtn}
              testID={`${testIDPrefix}-contact-btn`}
            />

            <Button
              title="In-App Help Center"
              variant="outline"
              onPress={() => router.push('/help-support')}
              style={styles.footerSecondaryBtn}
              testID={`${testIDPrefix}-help-btn`}
            />
          </View>

          {scrollRef && (
            <Pressable
              style={styles.backToTopBtn}
              onPress={handleBackToTop}
              testID={`${testIDPrefix}-back-to-top`}
            >
              <Text style={styles.backToTopText}>↑ Back to Top</Text>
            </Pressable>
          )}
        </Card.Content>
      </Card>

      {/* Table of Contents Modal */}
      <Modal
        visible={tocVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTocVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Table of Contents</Text>
                <Text style={styles.modalSubtitle}>{documentTitle}</Text>
              </View>
              <IconButton
                icon="close"
                size={22}
                onPress={() => setTocVisible(false)}
                testID={`${testIDPrefix}-toc-close`}
              />
            </View>

            <FlatList
              data={sections}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.tocListContent}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.tocItemPressable,
                    pressed && styles.tocItemPressed,
                  ]}
                  onPress={() => handleScrollToSection(item.id)}
                >
                  <View style={styles.tocItemNumberBadge}>
                    <Text style={styles.tocItemNumberText}>
                      {item.sectionNumber ? `${item.sectionNumber}` : '•'}
                    </Text>
                  </View>
                  <Text style={styles.tocItemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 2,
  },
  headerBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.marigoldLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  officialBadgeText: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  dateBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  dateBadgeText: {
    ...Typography.caption,
    color: Colors.inkSoft,
  },
  documentMainTitle: {
    ...Typography.title,
    fontSize: 22,
    color: Colors.indigo950,
    marginBottom: 6,
  },
  documentSubtitle: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    lineHeight: 20,
    marginBottom: 14,
  },
  actionRow: {
    marginBottom: 12,
  },
  tocTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  tocTriggerBtnText: {
    ...Typography.bodySm,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
    flex: 1,
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySm,
    color: Colors.ink,
    paddingVertical: 0,
  },
  searchResultBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  searchResultText: {
    ...Typography.caption,
    color: Colors.inkSoft,
  },
  searchResetLink: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    color: Colors.marigoldDeep,
  },
  sectionWrapper: {
    marginBottom: 2,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  sectionNumberBadge: {
    backgroundColor: Colors.marigoldLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginTop: 2,
  },
  sectionNumberText: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  sectionTitleText: {
    ...Typography.title,
    fontSize: 17,
    color: Colors.indigo950,
    flex: 1,
    lineHeight: 23,
  },
  subheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
  subheadingAccentBar: {
    width: 3,
    height: 16,
    backgroundColor: Colors.marigoldDeep,
    borderRadius: 2,
  },
  subheadingText: {
    ...Typography.body,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletDot: {
    ...Typography.bodySm,
    fontFamily: 'Manrope_700Bold',
    color: Colors.marigoldDeep,
    width: 14,
    lineHeight: 21,
  },
  bulletContent: {
    ...Typography.bodySm,
    color: Colors.ink,
    lineHeight: 21,
    flex: 1,
  },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 4,
  },
  numberedIndex: {
    ...Typography.bodySm,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
    width: 22,
    lineHeight: 21,
  },
  numberedContent: {
    ...Typography.bodySm,
    color: Colors.ink,
    lineHeight: 21,
    flex: 1,
  },
  bodyParagraph: {
    ...Typography.bodySm,
    color: Colors.ink,
    lineHeight: 21,
    marginBottom: 10,
  },
  regularText: {
    ...Typography.bodySm,
    color: Colors.ink,
    lineHeight: 21,
  },
  boldText: {
    ...Typography.bodySm,
    fontFamily: 'Manrope_700Bold',
    color: Colors.ink,
  },
  inlineCode: {
    ...Typography.caption,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: Colors.surface,
    color: Colors.indigo950,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.ivoryLine,
  },
  emailLink: {
    ...Typography.bodySm,
    fontFamily: 'Manrope_700Bold',
    color: Colors.marigoldDeep,
    textDecorationLine: 'underline',
  },
  docEndContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 6,
    gap: 10,
  },
  docEndDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.ivoryLine,
  },
  docEndText: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginTop: 10,
  },
  footerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  footerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.marigoldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerHeaderTextWrap: {
    flex: 1,
  },
  footerTitle: {
    ...Typography.title,
    fontSize: 16,
    color: Colors.indigo950,
  },
  footerSubtitle: {
    ...Typography.caption,
    color: Colors.inkSoft,
    marginTop: 2,
    lineHeight: 18,
  },
  footerButtonsWrap: {
    gap: 10,
  },
  footerPrimaryBtn: {
    marginTop: 4,
  },
  footerSecondaryBtn: {
    borderColor: Colors.ivoryLine,
  },
  backToTopBtn: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backToTopText: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    color: Colors.inkSoft,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '75%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  modalTitle: {
    ...Typography.title,
    fontSize: 18,
    color: Colors.indigo950,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  tocListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tocItemPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  tocItemPressed: {
    backgroundColor: Colors.marigoldLight,
  },
  tocItemNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  tocItemNumberText: {
    ...Typography.caption,
    fontFamily: 'Manrope_700Bold',
    color: Colors.indigo950,
  },
  tocItemTitle: {
    ...Typography.bodySm,
    color: Colors.ink,
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
  },
});
