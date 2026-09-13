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
import { Text, Card } from 'react-native-paper';
import type { TaskFormValues } from '@/domain/taskForm';
import {
  applyCategoryChange,
  formStateFromValues,
  formStateToValues,
  validateFormState,
  type TaskFormState,
} from '@/domain/taskForm';
import { TaskFormFields } from '@/components/TaskFormFields';
import { TaskScopeSection } from '@/components/taskForm/TaskScopeSection';
import { Button } from '@/components/Button';
import { Colors, Radius, AccentHex } from '@/constants/theme';
import { getCategoryAccent } from '@/constants/categoryHelpers';
import type { TranslationKey } from '@/i18n';
import type { Language, SharedMember } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';

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
  }, [initial, visible, initialShared, mode, activeHousehold]);

  if (!formState) return null;

  const patchForm = (patch: Partial<TaskFormState>) => {
    setFormState((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleCategoryChange = (category: TaskFormState['category']) => {
    setFormState((prev) => (prev ? applyCategoryChange(prev, category) : prev));
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
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
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

            <TaskScopeSection
              householdId={formState.householdId}
              assignedTo={formState.assignedTo}
              isRotating={formState.isRotating}
              rotationMembers={formState.rotationMembers}
              user={user}
              language={language}
              translate={translate}
              onChange={(patch) => {
                if (patch.shared !== undefined) {
                  setShared(patch.shared);
                }
                patchForm({
                  householdId: patch.householdId !== undefined ? patch.householdId : formState.householdId,
                  assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : formState.assignedTo,
                  isRotating: patch.isRotating !== undefined ? patch.isRotating : formState.isRotating,
                  rotationMembers: patch.rotationMembers !== undefined ? patch.rotationMembers : formState.rotationMembers,
                });
              }}
            />

            <Button
              title={
                saving
                  ? (language === 'hi' ? 'सहेज रहे हैं...' : 'Saving...')
                  : (saveLabel ?? (mode === 'edit' ? translate('savePreset') : translate('addFromPreset')))
              }
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
  body: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 80 },
  heading: { fontFamily: 'Fraunces_700Bold', fontSize: 22, color: Colors.ink, marginBottom: 2 },
  subHeading: { fontFamily: 'Manrope_500Medium', fontSize: 13, color: Colors.inkSoft, marginBottom: 16 },
});
