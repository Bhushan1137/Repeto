import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import type { TaskFormValues } from '@/domain/taskForm';
import {
  applyCategoryChange,
  formStateFromValues,
  formStateToValues,
  validateFormState,
  type TaskFormState,
} from '@/domain/taskForm';
import { TaskFormFields } from '@/components/TaskFormFields';
import { SelectField } from '@/components/SelectField';
import { Button } from '@/components/Button';
import { Colors, Radius, Typography, AccentHex } from '@/constants/theme';
import { getCategoryAccent } from '@/constants/categoryHelpers';
import type { TranslationKey } from '@/i18n';
import type { Language, SharedMember } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { canShareWith } from '@/domain/task';
import { initials } from '@/domain/insights';
import { toSharedMember, listHouseholds } from '@/domain/household';

import { Toast } from '@/components/Toast';

interface TaskFormSheetProps {
  visible: boolean;
  language: Language;
  translate: (key: TranslationKey) => string;
  heading: string;
  initial: TaskFormValues | null;
  mode: 'create' | 'edit';
  saveLabel?: string;
  onClose: () => void;
  onSave: (values: TaskFormValues, shared?: SharedMember[]) => void | Promise<void | boolean>;
  initialShared?: SharedMember[];
  editingTaskId?: string;
}

export function TaskFormSheet({
  visible,
  language,
  translate,
  heading,
  initial,
  mode,
  saveLabel,
  onClose,
  onSave,
  initialShared,
  editingTaskId,
}: TaskFormSheetProps) {
  const { user, activeHousehold } = useAuth();
  const { showToast, message } = useToast();
  const [formState, setFormState] = useState<TaskFormState | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateFormState>>({});
  const [shared, setShared] = useState<SharedMember[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initial || !visible) return;
    const base = formStateFromValues(initial);
    const defaultHhId = mode === 'create' && activeHousehold ? activeHousehold.id : base.householdId;
    setFormState({
      ...base,
      householdId: defaultHhId,
    });
    setErrors({});
    setShared(initialShared ?? []);
    setSaving(false);
  }, [initial, visible, initialShared, mode, activeHousehold?.id]);

  if (!formState) return null;

  const patchForm = (patch: Partial<TaskFormState>) => {
    setFormState((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleCategoryChange = (category: TaskFormState['category']) => {
    setFormState((prev) => (prev ? applyCategoryChange(prev, category) : prev));
  };

  const addContact = () => {
    const nextShared = [...shared];
    const members = user?.householdMembers ?? [];
    if (members.length === 0) {
      showToast(translate('addHouseholdFirst'));
      return;
    }
    const used = nextShared.map((s) => s.code ?? s.phone);
    const nextMember = members.find((m) => !used.includes(m.code));
    const next = nextMember ? toSharedMember(nextMember) : null;
    if (!next) {
      showToast(translate('allContactsAdded'));
      return;
    }
    nextShared.push(next);
    if (!canShareWith(user, nextShared)) {
      showToast(translate('sharedLimit'));
      return;
    }
    setShared(nextShared);
  };

  const removeContact = (phone: string) => {
    setShared(shared.filter((s) => s.phone !== phone));
  };

  const handleSave = async () => {
    const nextErrors = validateFormState(formState, translate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      await onSave(formStateToValues(formState, language), shared);
      onClose();
    } catch (err) {
      console.warn('[Repeato] TaskFormSheet save failed:', err);
      showToast(translate('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const categoryAccent = formState ? AccentHex[getCategoryAccent(formState.category)] : Colors.marigold;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Card style={styles.sheet} mode="elevated">
          <View style={[styles.categoryAccentStrip, { backgroundColor: categoryAccent }]} />
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.subHeading}>{translate('reviewAndCustomize')}</Text>

            <TaskFormFields
              language={language}
              translate={translate}
              state={formState}
              onChange={patchForm}
              onCategoryChange={handleCategoryChange}
              errors={errors}
              editingTaskId={editingTaskId}
              sharedMembers={shared}
            />

            {listHouseholds(user ?? ({} as any)).length > 0 ? (
              <View style={styles.shareSectionBlock}>
                <Text style={styles.label}>
                  {language === 'hi' ? 'घर / टैग (Household Context)' : 'Tag Household / Context:'}
                </Text>
                <View style={styles.hhPillsRow}>
                  {/* Option 1: Personal Task */}
                  <Pressable
                    onPress={() => patchForm({ householdId: null })}
                    style={[styles.hhPillBtn, !formState.householdId && styles.hhPillBtnActive]}
                  >
                    <Text style={styles.hhPillIcon}>👤</Text>
                    <Text style={[styles.hhPillText, !formState.householdId && styles.hhPillTextActive]}>
                      {language === 'hi' ? 'व्यक्तिगत (Personal)' : 'Personal'}
                    </Text>
                  </Pressable>

                  {/* Option 2+: User Households */}
                  {listHouseholds(user ?? ({} as any)).map((hh) => {
                    const isSelected = formState.householdId === hh.id;
                    return (
                      <Pressable
                        key={hh.id}
                        onPress={() => patchForm({ householdId: hh.id })}
                        style={[styles.hhPillBtn, isSelected && styles.hhPillBtnActive]}
                      >
                        <Text style={styles.hhPillIcon}>{hh.icon || '🏠'}</Text>
                        <Text style={[styles.hhPillText, isSelected && styles.hhPillTextActive]}>{hh.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Member Sharing Section */}
                {user?.householdMembers && user.householdMembers.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.label}>{translate('shareHousehold')}</Text>
                    <View style={styles.chips}>
                      {shared.map((s) => (
                        <Card key={s.phone} style={styles.chipCard} mode="elevated">
                          <TouchableRipple onPress={() => removeContact(s.phone)} style={styles.chipRipple} borderless>
                            <View style={styles.chipContent}>
                              <View style={[styles.chipAvatar, { backgroundColor: s.color }]}>
                                <Text style={styles.chipAvatarText}>{initials(s.name)}</Text>
                              </View>
                              <Text style={styles.chipText}>{s.name}</Text>
                              <Text style={styles.chipRemove}>×</Text>
                            </View>
                          </TouchableRipple>
                        </Card>
                      ))}
                      <Card style={styles.addChipCard} mode="elevated">
                        <TouchableRipple style={styles.addChipRipple} onPress={addContact} borderless>
                          <Text style={styles.addChipText}>{translate('addContact')}</Text>
                        </TouchableRipple>
                      </Card>
                    </View>
                  </View>
                )}

                {/* Assign to — Shown ONLY if shared with household member(s) */}
                {shared.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <SelectField
                      label={language === 'hi' ? 'किसे सौंपा गया' : 'Assign To'}
                      value={formState.assignedTo ?? ''}
                      options={[
                        { value: '', label: language === 'hi' ? 'किसी को नहीं (सामान्य)' : 'Unassigned (Shared)' },
                        { value: user?.id ?? 'me', label: language === 'hi' ? `आप (${user?.name})` : `You (${user?.name})` },
                        ...shared.map((s) => ({
                          value: s.code ?? s.phone,
                          label: s.name,
                        })),
                      ]}
                      onChange={(assignedTo) => patchForm({ assignedTo: assignedTo || null })}
                      testID="task-assigned-picker"
                    />
                  </View>
                )}
              </View>
            ) : null}

            <Button
              title={saveLabel ?? (mode === 'edit' ? translate('savePreset') : translate('addFromPreset'))}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={{ marginTop: 20 }}
              testID="task-form-save-btn"
            />
            <Button
              title={translate('backBtn')}
              variant="ghost"
              disabled={saving}
              style={{ marginTop: 10, marginBottom: 28 }}
              onPress={onClose}
              testID="task-form-cancel-btn"
            />
          </ScrollView>
        </Card>
        <Toast message={message} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,27,54,0.45)'
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: '92%',
    elevation: 8,
    overflow: 'hidden',
  },
  categoryAccentStrip: {
    height: 4,
    width: '100%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  body: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 36 },
  heading: { fontFamily: 'Fraunces_700Bold', fontSize: 22, color: Colors.ink, marginBottom: 2 },
  subHeading: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: Colors.inkSoft, marginBottom: 16 },
  shareSectionBlock: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginTop: 18,
  },
  label: { ...Typography.label, color: Colors.inkFaint, marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 6 },
  chipCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    elevation: 1,
    overflow: 'hidden',
  },
  chipRipple: {
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 6,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { fontSize: 9.5, color: Colors.white, fontFamily: 'Manrope_800ExtraBold' },
  chipText: { ...Typography.caption, color: Colors.ink, fontFamily: 'Manrope_700Bold' },
  chipRemove: { fontSize: 16, color: Colors.inkSoft, marginLeft: 2 },
  addChipCard: {
    backgroundColor: Colors.ivoryDim,
    borderRadius: Radius.full,
    elevation: 0.5,
    overflow: 'hidden',
  },
  addChipRipple: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addChipText: { ...Typography.caption, color: Colors.ink, fontFamily: 'Manrope_700Bold' },
  hhPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  hhPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  hhPillBtnActive: {
    backgroundColor: Colors.tealDeep,
    borderColor: Colors.tealDeep,
  },
  hhPillIcon: { fontSize: 13 },
  hhPillText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: Colors.ink,
  },
  hhPillTextActive: {
    color: Colors.white,
    fontFamily: 'Manrope_700Bold',
  },
});
