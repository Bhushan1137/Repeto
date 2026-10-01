import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Text, Card, TouchableRipple, ActivityIndicator } from 'react-native-paper';
import { CATEGORIES, CATEGORY_MAP } from '@/constants/categories';
import { Colors, Radius, Typography, Shadows } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/providers/AuthProvider';
import { useTasks } from '@/providers/TaskProvider';
import { useToast } from '@/providers/ToastProvider';
import { TaskFormSheet } from '@/components/TaskFormSheet';
import { getAllPresets, presetToFormValues, type PresetListItem } from '@/domain/preset';
import type { CategoryKey, Language, SharedMember } from '@/types';
import type { PresetTaskConfig } from '@/domain/task';
import type { TaskFormValues } from '@/domain/taskForm';

interface PresetLibrarySheetProps {
  visible: boolean;
  onClose: () => void;
  language: Language;
}

export function PresetLibrarySheet({ visible, onClose, language }: PresetLibrarySheetProps) {
  const { user, activeHousehold } = useAuth();
  const { batchAddPresets } = useTasks();
  const { translate } = useTranslation(language);
  const { showToast } = useToast();

  const isHi = language === 'hi';
  const allPresets = useMemo(() => getAllPresets(), []);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customConfigs, setCustomConfigs] = useState<Record<string, PresetTaskConfig>>({});
  const [editingPreset, setEditingPreset] = useState<PresetListItem | null>(null);
  const [targetHouseholdId, setTargetHouseholdId] = useState<string | null | undefined>(
    activeHousehold?.id ?? null
  );
  const [submitting, setSubmitting] = useState(false);

  // Available household targets (Active Household or Personal)
  const availableHouseholds = useMemo(() => {
    const list: { id: string | null; name: string; icon: string }[] = [];
    if (user?.households && user.households.length > 0) {
      for (const h of user.households) {
        list.push({ id: h.id, name: h.name, icon: h.icon || '🏠' });
      }
    } else if (activeHousehold) {
      list.push({ id: activeHousehold.id, name: activeHousehold.name, icon: activeHousehold.icon || '🏠' });
    }
    list.push({ id: null, name: translate('personalTasks'), icon: '👤' });
    return list;
  }, [user?.households, activeHousehold, translate]);

  // Filtered items
  const filteredPresets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allPresets.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }
      if (query.length === 0) return true;
      const titleEn = p.title.toLowerCase();
      const titleHi = p.titleHi.toLowerCase();
      const freqEn = p.freq.toLowerCase();
      const freqHi = p.freqHi.toLowerCase();
      return (
        titleEn.includes(query) ||
        titleHi.includes(query) ||
        freqEn.includes(query) ||
        freqHi.includes(query)
      );
    });
  }, [allPresets, selectedCategory, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredPresets.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleDeselectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredPresets.forEach((p) => next.delete(p.id));
      return next;
    });
  };

  const allVisibleSelected =
    filteredPresets.length > 0 && filteredPresets.every((p) => selectedIds.has(p.id));

  // Edit preset customization
  const handleOpenEdit = (preset: PresetListItem) => {
    setEditingPreset(preset);
  };

  const handleSaveCustomization = (formVals: TaskFormValues, _shared?: SharedMember[]) => {
    if (!editingPreset) return;
    const config: PresetTaskConfig = {
      title: formVals.title,
      category: formVals.category,
      freq: formVals.freq,
      amount: formVals.amount,
      finance: formVals.finance,
      icon: formVals.icon ?? editingPreset.icon,
      recurrence: formVals.recurrence,
      reminderTime: formVals.reminderTime,
      reminderTimes: formVals.reminderTimes,
      timesPerDay: formVals.timesPerDay,
      startDate: formVals.startDate,
      assignedTo: formVals.assignedTo,
      householdId: formVals.householdId ?? targetHouseholdId ?? null,
      note: formVals.note,
    };

    setCustomConfigs((prev) => ({
      ...prev,
      [editingPreset.id]: config,
    }));

    // Auto-select this preset
    setSelectedIds((prev) => new Set(prev).add(editingPreset.id));
    setEditingPreset(null);
    showToast(isHi ? 'कार्य विवरण अपडेट किया गया' : 'Task details customized');
  };

  // Build final list of configs for batch submission
  const handleBatchAdd = async () => {
    if (selectedIds.size === 0 || submitting) return;
    setSubmitting(true);

    try {
      const configsToAdd: PresetTaskConfig[] = [];
      for (const id of selectedIds) {
        if (customConfigs[id]) {
          configsToAdd.push(customConfigs[id]);
        } else {
          const raw = allPresets.find((p) => p.id === id);
          if (raw) {
            configsToAdd.push({
              title: isHi ? raw.titleHi : raw.title,
              category: raw.category,
              freq: isHi ? raw.freqHi : raw.freq,
              amount: raw.amount,
              finance: raw.finance,
              icon: raw.icon,
              householdId: targetHouseholdId ?? null,
            });
          }
        }
      }

      const added = await batchAddPresets(configsToAdd, targetHouseholdId);
      if (added > 0) {
        setSelectedIds(new Set());
        setCustomConfigs({});
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Initial values for editing preset sheet
  const editInitialValues = useMemo<TaskFormValues | null>(() => {
    if (!editingPreset) return null;
    const existingCustom = customConfigs[editingPreset.id];
    if (existingCustom) {
      return {
        title: existingCustom.title,
        category: existingCustom.category,
        freq: existingCustom.freq,
        recurrence: existingCustom.recurrence ?? { type: 'monthly' },
        amount: existingCustom.amount,
        finance: !!existingCustom.finance,
        reminderTime: existingCustom.reminderTime,
        reminderTimes: existingCustom.reminderTimes,
        timesPerDay: existingCustom.timesPerDay,
        startDate: existingCustom.startDate,
        assignedTo: existingCustom.assignedTo ?? undefined,
        householdId: existingCustom.householdId ?? undefined,
        icon: existingCustom.icon,
        note: existingCustom.note,
      };
    }
    return presetToFormValues(editingPreset, language);
  }, [editingPreset, customConfigs, language]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetContainer} testID="preset-library-sheet">
          {/* Top Drag Handle */}
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle} testID="preset-library-title">
                  {translate('presetLibraryTitle')}
                </Text>
                <View style={styles.counterBadge}>
                  <Text style={styles.counterBadgeText}>{allPresets.length}</Text>
                </View>
              </View>
              <Text style={styles.headerSub}>
                {translate('presetLibrarySub')}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              testID="preset-library-close-btn"
            >
              <AppIcon name="close" size={22} color={Colors.inkSoft} />
            </Pressable>
          </View>

          {/* Target Household Selector Bar */}
          {availableHouseholds.length > 1 && (
            <View style={styles.targetBar}>
              <Text style={styles.targetBarLabel}>{translate('addingTo')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetScroll}>
                {availableHouseholds.map((hh) => {
                  const isSelected = targetHouseholdId === hh.id;
                  return (
                    <Pressable
                      key={hh.id ?? 'personal'}
                      onPress={() => setTargetHouseholdId(hh.id)}
                      style={[styles.targetPill, isSelected && styles.targetPillActive]}
                    >
                      <Text style={styles.targetPillIcon}>{hh.icon}</Text>
                      <Text style={[styles.targetPillText, isSelected && styles.targetPillTextActive]}>
                        {hh.name}
                      </Text>
                      {isSelected ? <Text style={styles.targetCheck}> ✓</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Search Bar */}
          <View style={styles.searchWrap}>
            <AppIcon name="search-outline" size={18} color={Colors.inkFaint} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={translate('searchPresets')}
              placeholderTextColor={Colors.inkFaint}
              returnKeyType="search"
              clearButtonMode="while-editing"
              testID="preset-library-search-input"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <AppIcon name="close-circle" size={18} color={Colors.inkFaint} />
              </Pressable>
            )}
          </View>

          {/* Category Filter Chips */}
          <View style={styles.categoryChipsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              <Pressable
                style={[styles.catChip, selectedCategory === 'all' && styles.catChipActive]}
                onPress={() => setSelectedCategory('all')}
                testID="preset-cat-all"
              >
                <Text style={[styles.catChipText, selectedCategory === 'all' && styles.catChipTextActive]}>
                  {translate('allCategories')} ({allPresets.length})
                </Text>
              </Pressable>

              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                const catName = isHi ? cat.labelHi : cat.labelEn;
                const catCount = allPresets.filter((p) => p.category === cat.key).length;
                return (
                  <Pressable
                    key={cat.key}
                    style={[styles.catChip, isSelected && styles.catChipActive]}
                    onPress={() => setSelectedCategory(cat.key)}
                    testID={`preset-cat-${cat.key}`}
                  >
                    <Text style={styles.catChipIcon}>{cat.icon}</Text>
                    <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                      {catName} ({catCount})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Selection Control Sub-Bar */}
          <View style={styles.selectionBar}>
            <Text style={styles.selectionCount}>
              {translate('selectedCount', { count: selectedIds.size })}
            </Text>
            <View style={styles.selectionActions}>
              <Pressable
                onPress={allVisibleSelected ? handleDeselectAllVisible : handleSelectAllVisible}
                style={styles.quickActionBtn}
                hitSlop={8}
                testID="preset-library-select-all-btn"
              >
                <Text style={styles.quickActionText}>
                  {allVisibleSelected ? translate('deselectAll') : translate('selectAll')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Presets List */}
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            testID="preset-library-list"
          >
            {filteredPresets.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>{translate('noPresetsFound')}</Text>
              </View>
            ) : (
              filteredPresets.map((preset) => {
                const isSelected = selectedIds.has(preset.id);
                const isCustomized = !!customConfigs[preset.id];
                const cat = CATEGORY_MAP[preset.category] || { icon: '📋' };

                const activeConfig = customConfigs[preset.id];
                const title = activeConfig ? activeConfig.title : (isHi ? preset.titleHi : preset.title);
                const freq = activeConfig ? activeConfig.freq : (isHi ? preset.freqHi : preset.freq);
                const amount = activeConfig ? activeConfig.amount : preset.amount;
                const icon = activeConfig?.icon ?? preset.icon ?? cat.icon;

                return (
                  <Card
                    key={preset.id}
                    style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                    mode="elevated"
                    testID={`preset-card-${preset.id}`}
                  >
                    <TouchableRipple
                      onPress={() => toggleSelect(preset.id)}
                      style={styles.cardRipple}
                      borderless
                    >
                      <View style={styles.cardInner}>
                        {/* Checkbox circle */}
                        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>

                        {/* Category Icon */}
                        <View style={styles.iconCircle}>
                          <Text style={styles.iconText}>{icon}</Text>
                        </View>

                        {/* Task Details */}
                        <View style={styles.infoCol}>
                          <View style={styles.titleRow}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {title}
                            </Text>
                            {isCustomized && (
                              <View style={styles.customBadge}>
                                <Text style={styles.customBadgeText}>
                                  {isHi ? 'संपादित' : 'Custom'}
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text style={styles.cardFreq} numberOfLines={1}>
                            {freq}
                            {amount ? ` · ₹${amount.toLocaleString('en-IN')}` : ''}
                          </Text>
                        </View>

                        {/* Inline Customize Button */}
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleOpenEdit(preset);
                          }}
                          style={styles.editBtn}
                          hitSlop={8}
                          testID={`preset-edit-btn-${preset.id}`}
                        >
                          <AppIcon name="create-outline" size={16} color={Colors.tealDeep} />
                          <Text style={styles.editBtnText}>
                            {translate('editPreset')}
                          </Text>
                        </Pressable>
                      </View>
                    </TouchableRipple>
                  </Card>
                );
              })
            )}
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          <View style={styles.footerBar}>
            <View style={styles.footerInfoCol}>
              <Text style={styles.footerCount}>
                {translate('selectedCount', { count: selectedIds.size })}
              </Text>
              <Text style={styles.footerTarget} numberOfLines={1}>
                {translate('addingTo')}{' '}
                {availableHouseholds.find((h) => h.id === targetHouseholdId)?.name ?? translate('personalTasks')}
              </Text>
            </View>

            <Pressable
              style={[
                styles.primaryAddBtn,
                (selectedIds.size === 0 || submitting) && styles.primaryAddBtnDisabled,
              ]}
              onPress={handleBatchAdd}
              disabled={selectedIds.size === 0 || submitting}
              testID="preset-library-add-btn"
            >
              {submitting ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Text style={styles.primaryAddBtnText}>
                    {translate('addTasksAction', { count: selectedIds.size })}
                  </Text>
                  <AppIcon name="chevron-forward" size={18} color={Colors.white} />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Task Customization Modal */}
      {editingPreset && editInitialValues && (
        <TaskFormSheet
          visible={!!editingPreset}
          language={language}
          translate={translate}
          heading={isHi ? 'कार्य विवरण अनुकूलित करें' : 'Customize Preset Schedule'}
          initial={editInitialValues}
          mode="create"
          saveLabel={isHi ? 'सहेजें' : 'Save Details'}
          onClose={() => setEditingPreset(null)}
          onSave={handleSaveCustomization}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '75%',
    ...Shadows.lg,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.inkFaint,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitleCol: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    ...Typography.displaySm,
    fontWeight: '800',
    color: Colors.ink,
  },
  counterBadge: {
    backgroundColor: 'rgba(62, 124, 106, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  counterBadgeText: {
    ...Typography.bodySm,
    fontWeight: '700',
    color: Colors.tealDeep,
  },
  headerSub: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    marginTop: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceMuted,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  targetBarLabel: {
    ...Typography.bodySm,
    fontWeight: '600',
    color: Colors.inkSoft,
    marginRight: 8,
  },
  targetScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 12,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  targetPillActive: {
    backgroundColor: Colors.indigo950,
    borderColor: Colors.indigo950,
  },
  targetPillIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  targetPillText: {
    ...Typography.bodySm,
    fontWeight: '600',
    color: Colors.ink,
  },
  targetPillTextActive: {
    color: Colors.white,
  },
  targetCheck: {
    color: Colors.marigold,
    fontWeight: '800',
    fontSize: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.ink,
    marginLeft: 8,
    height: '100%',
  },
  categoryChipsWrap: {
    paddingVertical: 6,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catChipActive: {
    backgroundColor: 'rgba(62, 124, 106, 0.14)',
    borderColor: Colors.tealDeep,
  },
  catChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  catChipText: {
    ...Typography.bodySm,
    fontWeight: '600',
    color: Colors.inkSoft,
  },
  catChipTextActive: {
    color: Colors.tealDeep,
    fontWeight: '700',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  selectionCount: {
    ...Typography.bodySm,
    fontWeight: '600',
    color: Colors.inkSoft,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  quickActionText: {
    ...Typography.bodySm,
    fontWeight: '700',
    color: Colors.indigo900,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
    gap: 10,
  },
  presetCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  presetCardSelected: {
    borderColor: Colors.tealDeep,
    backgroundColor: '#F7FCF9',
  },
  cardRipple: {
    padding: 12,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: Colors.tealDeep,
    borderColor: Colors.tealDeep,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
    marginTop: -1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  infoCol: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    ...Typography.title,
    fontWeight: '700',
    color: Colors.ink,
    flexShrink: 1,
  },
  customBadge: {
    backgroundColor: 'rgba(232, 163, 61, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.marigoldDeep,
  },
  cardFreq: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(62, 124, 106, 0.08)',
    gap: 4,
  },
  editBtnText: {
    ...Typography.bodySm,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tealDeep,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    ...Typography.body,
    color: Colors.inkSoft,
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryLine,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    ...Shadows.md,
  },
  footerInfoCol: {
    flex: 1,
    paddingRight: 12,
  },
  footerCount: {
    ...Typography.title,
    fontWeight: '800',
    color: Colors.ink,
  },
  footerTarget: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tealDeep,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    gap: 8,
  },
  primaryAddBtnDisabled: {
    backgroundColor: Colors.inkFaint,
    opacity: 0.6,
  },
  primaryAddBtnText: {
    ...Typography.title,
    color: Colors.white,
    fontWeight: '700',
  },
});
