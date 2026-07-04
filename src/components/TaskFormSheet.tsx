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
import { Button } from '@/components/Button';
import { Colors, Radius, Typography, Shadows } from '@/constants/theme';
import type { TranslationKey } from '@/i18n';
import type { Language, SharedMember } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { canShareWith } from '@/domain/task';
import { initials } from '@/domain/insights';
import { toSharedMember } from '@/domain/household';

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
  onSave: (values: TaskFormValues, shared?: SharedMember[]) => void;
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
  const { user } = useAuth();
  const { showToast, message } = useToast();
  const [formState, setFormState] = useState<TaskFormState | null>(null);
  const [errors, setErrors] = useState<ReturnType<typeof validateFormState>>({});
  const [shared, setShared] = useState<SharedMember[]>([]);

  useEffect(() => {
    if (!initial || !visible) return;
    setFormState(formStateFromValues(initial));
    setErrors({});
    setShared(initialShared ?? []);
  }, [initial, visible, initialShared]);

  if (!initial || !formState) return null;

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

  const handleSave = () => {
    const nextErrors = validateFormState(formState, translate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(formStateToValues(formState, language), shared);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Card style={styles.sheet} mode="elevated">
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>{heading}</Text>

            <TaskFormFields
              language={language}
              translate={translate}
              state={formState}
              onChange={patchForm}
              onCategoryChange={handleCategoryChange}
              errors={errors}
              editingTaskId={editingTaskId}
            />

            {mode === 'edit' ? (
              <>
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
              </>
            ) : null}

            <Button
              title={saveLabel ?? (mode === 'edit' ? translate('savePreset') : translate('addFromPreset'))}
              onPress={handleSave}
              style={{ marginTop: 20 }}
            />
            <Button
              title={translate('backBtn')}
              variant="ghost"
              style={{ marginTop: 10, marginBottom: 28 }}
              onPress={onClose}
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
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.ivoryLine,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  body: { paddingHorizontal: 22, paddingBottom: 28 },
  heading: { fontFamily: 'Fraunces_700Bold', fontSize: 20, color: Colors.ink, marginBottom: 12 },
  label: { ...Typography.label, color: Colors.inkSoft, marginBottom: 8, marginTop: 16 },
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
});
