import React from 'react';
import { View, StyleSheet, ScrollView, Modal, Pressable, Text } from 'react-native';
import { Card, TouchableRipple } from 'react-native-paper';
import type { CategoryKey, Language } from '@/types';
import { CATEGORIES, CATEGORY_GROUPS } from '@/constants/categories';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import { Colors, Radius } from '@/constants/theme';

interface CategoryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCategory: CategoryKey;
  onSelectCategory: (category: CategoryKey) => void;
  language: Language;
  translate: (key: any, params?: Record<string, string | number>) => string;
}

export function CategoryPickerModal({
  visible,
  onClose,
  selectedCategory,
  onSelectCategory,
  language,
  translate,
}: CategoryPickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.modalTitle}>{translate('parseCategory')}</Text>
          <Text style={styles.modalSub}>
            {language === 'hi' ? 'अपने कार्य के लिए श्रेणी चुनें' : 'Choose a category for your task'}
          </Text>

          {CATEGORY_GROUPS.map((group) => (
            <View key={group.key} style={styles.groupBlock}>
              <Text style={styles.groupLabel}>
                {language === 'hi' ? group.labelHi : group.labelEn}
              </Text>
              <View style={styles.catGrid}>
                {CATEGORIES.filter((c) => c.group === group.key).map((cat) => {
                  const active = selectedCategory === cat.key;
                  return (
                    <Card
                      key={cat.key}
                      style={[styles.catChip, active && styles.catChipActive]}
                      mode="elevated"
                    >
                      <TouchableRipple
                        onPress={() => {
                          onSelectCategory(cat.key);
                          onClose();
                        }}
                        testID={`task-category-chip-${cat.key}`}
                        style={styles.catChipInner}
                        borderless
                      >
                        <View style={styles.catContent}>
                          <Text style={styles.catChipIcon}>{cat.icon}</Text>
                          <Text
                            style={[
                              styles.catChipText,
                              active && styles.catChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {getCategoryLabel(cat.key, language)}
                          </Text>
                        </View>
                      </TouchableRipple>
                    </Card>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  modalSheet: {
    maxHeight: '80%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 12,
    elevation: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.ivoryLine,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.ink,
  },
  modalSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    marginTop: 2,
    marginBottom: 16,
  },
  groupBlock: {
    marginBottom: 16,
  },
  groupLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  catChipActive: {
    backgroundColor: '#E6F4F1',
    borderColor: Colors.tealDeep,
    borderWidth: 1.5,
  },
  catChipInner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  catContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catChipIcon: {
    fontSize: 18,
  },
  catChipText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: Colors.ink,
    flex: 1,
  },
  catChipTextActive: {
    fontFamily: 'Manrope_700Bold',
    color: Colors.tealDeep,
  },
});
