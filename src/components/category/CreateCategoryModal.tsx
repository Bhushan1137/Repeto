/**
 * CreateCategoryModal
 * ────────────────────
 * Full-featured bottom sheet modal for creating or editing a custom category.
 *
 * Features:
 *  - Emoji picker with curated palette of 40+ emojis
 *  - Name field (English + optional Hindi)
 *  - Group picker (Finance / Home / Lifestyle)
 *  - Accent colour picker (Clay / Teal / Marigold)
 *  - Inline live preview card
 *  - Create / Update / Delete with confirmation
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Card, Text, TouchableRipple } from 'react-native-paper';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/Button';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { useCategories, type CreateCustomCategoryInput } from '@/hooks/useCategories';
import type { CustomCategoryDef, CustomCategoryKey, Language } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMOJI_PALETTE: string[] = [
  '📦', '🗂️', '📋', '🧾', '🔖', '📌', '📍', '🗒️',
  '🏡', '🏗️', '🪟', '🚪', '🛋️', '🪑', '🧹', '🧺',
  '🌿', '🌻', '🍀', '🎋', '🪴', '🌾', '🍃', '🌱',
  '🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🎮', '🕹️',
  '🧘', '🏊', '🚴', '⛷️', '🤸', '🏋️', '🧗', '🏄',
  '🍽️', '🍱', '🫖', '☕', '🍲', '🥗', '🫙', '🧃',
  '💻', '📱', '🖨️', '📷', '🔭', '🔬', '🧪', '🔋',
  '✈️', '🚂', '⛵', '🚁', '🛕', '⛪', '🕌', '🛤️',
  '💎', '🏆', '🎁', '🎀', '🪅', '🎊', '🎉', '🥇',
  '🌙', '⭐', '🌞', '🌈', '❄️', '🌊', '🔥', '⚡',
];

const ACCENT_OPTIONS: { key: CustomCategoryDef['accent']; label: string; color: string }[] = [
  { key: 'clay', label: 'Clay', color: Colors.clay },
  { key: 'teal', label: 'Teal', color: Colors.teal },
  { key: 'marigold', label: 'Marigold', color: Colors.marigold },
];

const GROUP_OPTIONS: { key: CustomCategoryDef['group']; labelEn: string; labelHi: string; icon: string }[] = [
  { key: 'money', labelEn: 'Finance', labelHi: 'वित्त', icon: '💰' },
  { key: 'home', labelEn: 'Home', labelHi: 'घर', icon: '🏠' },
  { key: 'life', labelEn: 'Lifestyle', labelHi: 'जीवनशैली', icon: '✨' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface CreateCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  /** If provided, the modal opens in edit mode for this category */
  editCategory?: CustomCategoryDef | null;
  language: Language;
  /** Called after a category is successfully created or updated */
  onSaved?: (category: CustomCategoryDef) => void;
  /** Called after a category is successfully deleted */
  onDeleted?: (key: CustomCategoryKey) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateCategoryModal({
  visible,
  onClose,
  editCategory,
  language,
  onSaved,
  onDeleted,
}: CreateCategoryModalProps) {
  const isHi = language === 'hi';
  const isEdit = !!editCategory;

  const { addCategory, updateCategory, deleteCategory } = useCategories();

  // ── Form state ──
  const [labelEn, setLabelEn] = useState('');
  const [labelHi, setLabelHi] = useState('');
  const [icon, setIcon] = useState('📦');
  const [accent, setAccent] = useState<CustomCategoryDef['accent']>('teal');
  const [group, setGroup] = useState<CustomCategoryDef['group']>('life');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<{ labelEn?: string }>({});

  // ── Reset / hydrate when opening ──
  useEffect(() => {
    if (visible) {
      if (editCategory) {
        setLabelEn(editCategory.labelEn);
        setLabelHi(editCategory.labelHi ?? '');
        setIcon(editCategory.icon);
        setAccent(editCategory.accent);
        setGroup(editCategory.group);
      } else {
        setLabelEn('');
        setLabelHi('');
        setIcon('📦');
        setAccent('teal');
        setGroup('life');
      }
      setErrors({});
    }
  }, [visible, editCategory]);

  // ── Validation ──
  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!labelEn.trim() || labelEn.trim().length < 2) {
      e.labelEn = isHi ? 'नाम कम से कम 2 अक्षर होना चाहिए' : 'Name must be at least 2 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const input: CreateCustomCategoryInput = {
        labelEn: labelEn.trim(),
        labelHi: labelHi.trim() || undefined,
        icon,
        accent,
        group,
      };

      if (isEdit && editCategory) {
        await updateCategory(editCategory.key, input);
        const updated: CustomCategoryDef = { ...editCategory, ...input };
        onSaved?.(updated);
      } else {
        const created = await addCategory(input);
        onSaved?.(created);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }, [labelEn, labelHi, icon, accent, group, isEdit, editCategory, addCategory, updateCategory, onSaved, onClose]);

  // ── Delete ──
  const handleDelete = useCallback(() => {
    if (!editCategory) return;

    const doDelete = async () => {
      setDeleting(true);
      try {
        await deleteCategory(editCategory.key);
        onDeleted?.(editCategory.key);
        onClose();
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(isHi ? 'क्या आप इस श्रेणी को हटाना चाहते हैं?' : 'Delete this category?')) {
        doDelete();
      }
    } else {
      Alert.alert(
        isHi ? 'श्रेणी हटाएं' : 'Delete Category',
        isHi
          ? 'इस श्रेणी को हटाने से इसमें बनाए गए कार्य "bills" श्रेणी में चले जाएंगे।'
          : 'Tasks using this category will fall back to "Bills". This cannot be undone.',
        [
          { text: isHi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
          { text: isHi ? 'हटाएं' : 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  }, [editCategory, deleteCategory, isHi, onDeleted, onClose]);

  // ── Preview label for current accent ──
  const accentColor = ACCENT_OPTIONS.find((a) => a.key === accent)?.color ?? Colors.teal;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Card style={styles.sheet} mode="elevated">
          {/* Handle */}
          <View style={styles.handle} />

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Header ── */}
            <View style={styles.headerRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: `${accentColor}22` }]}>
                <Text style={styles.headerEmoji}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {isEdit
                    ? (isHi ? 'श्रेणी संपादित करें' : 'Edit Category')
                    : (isHi ? 'नई श्रेणी बनाएं' : 'Create Category')}
                </Text>
                <Text style={styles.sheetSub}>
                  {isHi
                    ? 'अपनी ज़रूरत के अनुसार कस्टम श्रेणी बनाएं'
                    : 'Personalise Repeto with your own category'}
                </Text>
              </View>
            </View>

            {/* ── Live Preview Card ── */}
            <View style={[styles.previewCard, { borderLeftColor: accentColor }]}>
              <Text style={styles.previewEmoji}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewLabel} numberOfLines={1}>
                  {labelEn.trim() || (isHi ? 'श्रेणी का नाम' : 'Category name')}
                </Text>
                {labelHi.trim() ? (
                  <Text style={styles.previewLabelHi} numberOfLines={1}>{labelHi.trim()}</Text>
                ) : null}
                <View style={[styles.previewAccentBadge, { backgroundColor: `${accentColor}22` }]}>
                  <Text style={[styles.previewAccentText, { color: accentColor }]}>
                    {GROUP_OPTIONS.find((g) => g.key === group)?.labelEn ?? 'Lifestyle'}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Emoji Picker ── */}
            <Text style={styles.fieldLabel}>
              {isHi ? 'आइकन चुनें' : 'Choose Icon'}
            </Text>
            <View style={styles.emojiGrid}>
              {EMOJI_PALETTE.map((em) => (
                <Pressable
                  key={em}
                  style={[styles.emojiCell, icon === em && { backgroundColor: `${accentColor}33`, borderColor: accentColor, borderWidth: 2 }]}
                  onPress={() => setIcon(em)}
                  testID={`emoji-picker-${em}`}
                >
                  <Text style={styles.emojiGlyph}>{em}</Text>
                </Pressable>
              ))}
            </View>

            {/* ── Category Name (English) ── */}
            <Text style={styles.fieldLabel}>
              {isHi ? 'श्रेणी का नाम (अंग्रेज़ी)*' : 'Category Name (English)*'}
            </Text>

            <_TextInputField
              value={labelEn}
              onChangeText={setLabelEn}
              placeholder={isHi ? 'जैसे: कार वॉश' : 'e.g. Car Wash'}
              hasError={!!errors.labelEn}
              testID="custom-cat-name-en"
            />
            {errors.labelEn ? (
              <Text style={styles.errorText}>{errors.labelEn}</Text>
            ) : null}

            {/* ── Category Name (Hindi — optional) ── */}
            <Text style={styles.fieldLabel}>
              {isHi ? 'हिन्दी नाम (वैकल्पिक)' : 'Hindi Name (optional)'}
            </Text>
            <_TextInputField
              value={labelHi}
              onChangeText={setLabelHi}
              placeholder={isHi ? 'जैसे: कार वॉश' : 'e.g. कार वॉश'}
              testID="custom-cat-name-hi"
            />

            {/* ── Accent Colour ── */}
            <Text style={styles.fieldLabel}>
              {isHi ? 'रंग' : 'Colour'}
            </Text>
            <View style={styles.accentRow}>
              {ACCENT_OPTIONS.map((a) => (
                <Pressable
                  key={a.key}
                  style={[
                    styles.accentChip,
                    { backgroundColor: `${a.color}22`, borderColor: a.color },
                    accent === a.key && { backgroundColor: a.color },
                  ]}
                  onPress={() => setAccent(a.key)}
                  testID={`accent-${a.key}`}
                >
                  <Text style={[styles.accentLabel, accent === a.key && { color: Colors.white }]}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── Group / Section ── */}
            <Text style={styles.fieldLabel}>
              {isHi ? 'सेक्शन' : 'Section'}
            </Text>
            <View style={styles.groupRow}>
              {GROUP_OPTIONS.map((g) => (
                <Pressable
                  key={g.key}
                  style={[
                    styles.groupChip,
                    group === g.key && { backgroundColor: `${accentColor}22`, borderColor: accentColor },
                  ]}
                  onPress={() => setGroup(g.key)}
                  testID={`group-${g.key}`}
                >
                  <Text style={styles.groupIcon}>{g.icon}</Text>
                  <Text style={[styles.groupLabel, group === g.key && { color: accentColor, fontWeight: '700' }]}>
                    {isHi ? g.labelHi : g.labelEn}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── Actions ── */}
            <Button
              title={
                saving
                  ? (isHi ? 'सहेज रहे हैं…' : 'Saving…')
                  : isEdit
                    ? (isHi ? 'बदलाव सहेजें' : 'Save Changes')
                    : (isHi ? 'श्रेणी बनाएं' : 'Create Category')
              }
              onPress={handleSave}
              loading={saving}
              disabled={saving || deleting}
              style={styles.saveBtn}
              testID="custom-cat-save-btn"
            />

            {isEdit && (
              <Button
                title={deleting ? (isHi ? 'हटाया जा रहा है…' : 'Deleting…') : (isHi ? 'श्रेणी हटाएं' : 'Delete Category')}
                variant="ghost"
                onPress={handleDelete}
                loading={deleting}
                disabled={saving || deleting}
                style={styles.deleteBtn}
                testID="custom-cat-delete-btn"
              />
            )}

            <Button
              title={isHi ? 'रद्द करें' : 'Cancel'}
              variant="ghost"
              onPress={onClose}
              disabled={saving || deleting}
              style={styles.cancelBtn}
              testID="custom-cat-cancel-btn"
            />
          </ScrollView>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Internal controlled text input ───────────────────────────────────────────

import { TextInput } from 'react-native';

function _TextInputField({
  value,
  onChangeText,
  placeholder,
  hasError,
  testID,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
  testID?: string;
}) {
  return (
    <TextInput
      style={[styles.nativeInput, hasError && styles.nativeInputError]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.inkFaint}
      autoCapitalize="words"
      returnKeyType="done"
      testID={testID}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modalContainer: {
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
    maxHeight: '92%',
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
  body: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 40,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
    marginBottom: 16,
  },
  headerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEmoji: {
    fontSize: 28,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.ink,
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 13,
    color: Colors.inkSoft,
    marginTop: 2,
  },

  // Preview
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    borderLeftWidth: 4,
    marginBottom: 20,
    ...Shadows.sm,
  },
  previewEmoji: {
    fontSize: 32,
  },
  previewLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ink,
  },
  previewLabelHi: {
    fontSize: 13,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  previewAccentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  previewAccentText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Emoji grid
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 20,
  },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: Radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
  },
  emojiGlyph: {
    fontSize: 22,
  },

  // Field label
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.inkSoft,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },


  // Actual TextInput style
  nativeInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xs,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: Colors.ink,
    marginBottom: 16,
  },
  nativeInputError: {
    borderColor: Colors.clay,
  },
  errorText: {
    fontSize: 11,
    color: Colors.clay,
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 2,
  },

  // Accent picker
  accentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  accentChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ink,
  },

  // Group picker
  groupRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  groupChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
  },
  groupIcon: {
    fontSize: 20,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.inkSoft,
  },

  // Action buttons
  saveBtn: {
    marginTop: 4,
  },
  deleteBtn: {
    marginTop: 8,
  },
  cancelBtn: {
    marginTop: 4,
    marginBottom: 8,
  },
});
