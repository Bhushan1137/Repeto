/**
 * ManageCategoriesSheet
 * ─────────────────────
 * Bottom-sheet that lists all user-created custom categories,
 * lets the user edit each one, and has a "+ Create" CTA at the bottom.
 *
 * Integrates with useCategories hook and opens CreateCategoryModal
 * as an inner modal for create/edit flows.
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Card, Text, TouchableRipple } from 'react-native-paper';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { CreateCategoryModal } from '@/components/category/CreateCategoryModal';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/useCategories';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/hooks/useTranslation';
import type { CustomCategoryDef, Language } from '@/types';

const ACCENT_COLORS: Record<'clay' | 'teal' | 'marigold', string> = {
  clay: Colors.clay,
  teal: Colors.teal,
  marigold: Colors.marigold,
};

interface ManageCategoriesSheetProps {
  visible: boolean;
  onClose: () => void;
  language: Language;
}

export function ManageCategoriesSheet({
  visible,
  onClose,
  language,
}: ManageCategoriesSheetProps) {
  const isHi = language === 'hi';
  const { translate } = useTranslation(language);
  const { showToast } = useToast();
  const { customCategories, loading } = useCategories();

  const [showCreate, setShowCreate] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategoryDef | null>(null);

  const handleEdit = (cat: CustomCategoryDef) => {
    setEditingCategory(cat);
    setShowCreate(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setShowCreate(true);
  };

  const handleSaved = (cat: CustomCategoryDef) => {
    const name = isHi ? (cat.labelHi || cat.labelEn) : cat.labelEn;
    if (editingCategory) {
      showToast(translate('categoryUpdated'));
    } else {
      showToast(translate('categoryCreated').replace('{name}', name));
    }
  };

  const handleDeleted = () => {
    showToast(translate('categoryDeleted'));
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <Pressable style={styles.backdrop} onPress={onClose} />

          <Card style={styles.sheet} mode="elevated">
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{translate('manageCategoriesTitle')}</Text>
                <Text style={styles.subtitle}>{translate('manageCategoriesSub')}</Text>
              </View>
              <TouchableRipple onPress={onClose} style={styles.closeBtn} borderless>
                <AppIcon name="close" size={22} color={Colors.inkSoft} />
              </TouchableRipple>
            </View>

            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              {/* Empty state */}
              {!loading && customCategories.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📂</Text>
                  <Text style={styles.emptyTitle}>{translate('noCategoriesYet')}</Text>
                  <Text style={styles.emptySub}>{translate('noCategoriesYetSub')}</Text>
                </View>
              )}

              {/* Category list */}
              {customCategories.map((cat) => {
                const accentColor = ACCENT_COLORS[cat.accent];
                return (
                  <TouchableRipple
                    key={cat.key}
                    style={styles.catRow}
                    onPress={() => handleEdit(cat)}
                    testID={`manage-cat-row-${cat.key}`}
                  >
                    <>
                      {/* Left accent stripe */}
                      <View style={[styles.catStripe, { backgroundColor: accentColor }]} />

                      <View style={styles.catIconCircle}>
                        <Text style={styles.catEmoji}>{cat.icon}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={styles.catLabelRow}>
                          <Text style={styles.catLabelEn} numberOfLines={1}>
                            {isHi ? (cat.labelHi || cat.labelEn) : cat.labelEn}
                          </Text>
                          <View style={[styles.customBadge, { backgroundColor: `${accentColor}22` }]}>
                            <Text style={[styles.customBadgeText, { color: accentColor }]}>
                              {translate('customBadge')}
                            </Text>
                          </View>
                        </View>
                        {isHi && cat.labelHi && cat.labelHi !== cat.labelEn && (
                          <Text style={styles.catLabelSub} numberOfLines={1}>{cat.labelEn}</Text>
                        )}
                      </View>

                      <AppIcon name="chevron-forward" size={16} color={Colors.inkFaint} />
                    </>
                  </TouchableRipple>
                );
              })}

              {/* Create CTA */}
              <Button
                title={isHi ? '+ नई श्रेणी बनाएं' : '+ Create New Category'}
                onPress={handleCreate}
                style={styles.createBtn}
                testID="manage-cat-create-btn"
              />

              <Button
                title={isHi ? 'बंद करें' : 'Close'}
                variant="ghost"
                onPress={onClose}
                style={styles.closeSheetBtn}
                testID="manage-cat-close-btn"
              />
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* Inner create/edit modal */}
      <CreateCategoryModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        editCategory={editingCategory}
        language={language}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    maxHeight: '88%',
    backgroundColor: Colors.ivory,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ivoryLine,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.full,
  },
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 40,
    gap: 8,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ink,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    maxWidth: 240,
  },

  // Category row
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingRight: 14,
    gap: 12,
    ...Shadows.sm,
  },
  catStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  catIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji: {
    fontSize: 22,
  },
  catLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  catLabelEn: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ink,
    flex: 1,
  },
  catLabelSub: {
    fontSize: 13,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  customBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Buttons
  createBtn: {
    marginTop: 16,
  },
  closeSheetBtn: {
    marginTop: 8,
  },
});
