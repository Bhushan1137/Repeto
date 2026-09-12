import React, { useRef, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  Animated,
  Platform,
  SafeAreaView,
  Keyboard,
  StatusBar,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { RepeatingTask } from '@/types';
import { CATEGORIES, CATEGORY_MAP } from '@/constants/categories';
import { AccentHex, Colors, Radius } from '@/constants/theme';
import { getCategoryAccent, getCategoryLabel } from '@/constants/categoryHelpers';
import { daysUntilDue } from '@/domain/recurrence';
import { AppIcon } from '@/components/AppIcon';
import { TaskHistoryPanel } from '@/components/TaskHistoryPanel';
import { useTaskReportState } from '@/hooks/useTaskReport';
import {
  cycleSort,
  sortLabel,
  type TaskStatusFilter,
  type TaskReportRow,
} from '@/domain/taskReport';

interface TaskReportModalProps {
  visible: boolean;
  onClose: () => void;
  tasks: RepeatingTask[];
  language: 'en' | 'hi';
}

// ─── Status chip configs ─────────────────────────────────────────────────

const STATUS_CHIPS: { key: TaskStatusFilter; labelEn: string; labelHi: string; icon: string }[] = [
  { key: 'all',        labelEn: 'All',        labelHi: 'सभी',         icon: 'grid-outline' },
  { key: 'overdue',    labelEn: 'Overdue',    labelHi: 'अतिदेय',      icon: 'warning-outline' },
  { key: 'slipping',   labelEn: 'Slipping',   labelHi: 'फिसलते',     icon: 'time-outline' },
  { key: 'on_track',   labelEn: 'On Track',   labelHi: 'सही राह',     icon: 'checkmark-circle-outline' },
  { key: 'no_history', labelEn: 'No History', labelHi: 'इतिहास नहीं', icon: 'document-text-outline' },
  { key: 'shared',     labelEn: 'Shared',     labelHi: 'साझा',       icon: 'people-outline' },
  { key: 'finance',    labelEn: 'Finance',    labelHi: 'वित्त',       icon: 'bookmark-outline' },
];

// ─── Status visuals ───────────────────────────────────────────────────────

function getStatusTheme(status: TaskReportRow['status']) {
  if (status === 'on_track') {
    return {
      color: '#15803D',
      bg: '#DCFCE7',
      border: '#86EFAC',
      labelEn: 'On Track',
      labelHi: 'सही राह',
      dotColor: '#22C55E',
      icon: 'checkmark-circle-outline' as const,
    };
  }
  if (status === 'slipping') {
    return {
      color: '#B45309',
      bg: '#FEF3C7',
      border: '#FDE68A',
      labelEn: 'Slipping',
      labelHi: 'फिसलते',
      dotColor: '#F59E0B',
      icon: 'time-outline' as const,
    };
  }
  if (status === 'overdue') {
    return {
      color: '#B91C1C',
      bg: '#FEE2E2',
      border: '#FCA5A5',
      labelEn: 'Overdue',
      labelHi: 'अतिदेय',
      dotColor: '#EF4444',
      icon: 'warning-outline' as const,
    };
  }
  return {
    color: Colors.inkSoft,
    bg: '#F3F4F6',
    border: '#E5E7EB',
    labelEn: 'No Data',
    labelHi: 'इतिहास नहीं',
    dotColor: Colors.inkFaint,
    icon: 'document-text-outline' as const,
  };
}

// ─── Enhanced Task Row Card ───────────────────────────────────────────────

function TaskRowCard({
  row,
  language,
  onPress,
}: {
  row: TaskReportRow;
  language: 'en' | 'hi';
  onPress: () => void;
}) {
  const { task, onTimePercent, status } = row;
  const cat = CATEGORY_MAP[task.category] ?? CATEGORY_MAP['home'];
  const accent = AccentHex[getCategoryAccent(task.category)];
  const theme = getStatusTheme(status);
  const isLateDone = onTimePercent === 0 && row.totalDone > 0;
  const barWidth = onTimePercent === -1 ? 0 : isLateDone ? 60 : onTimePercent;
  const percentText =
    onTimePercent === -1
      ? '—'
      : isLateDone
      ? language === 'hi'
        ? 'विलंबित'
        : 'Late'
      : `${onTimePercent}%`;

  const days = daysUntilDue(task.nextDueDate);

  const dueStyle = days < 0
    ? { bg: '#FEE2E2', text: '#B91C1C' }
    : days === 0
    ? { bg: '#FEF3C7', text: '#B45309' }
    : { bg: Colors.surfaceMuted, text: Colors.inkSoft };

  const dueLabel = days < 0
    ? (language === 'hi' ? `${Math.abs(days)} दिन देरी` : `${Math.abs(days)}d overdue`)
    : days === 0
    ? (language === 'hi' ? 'आज देय' : 'Due Today')
    : days === 1
    ? (language === 'hi' ? 'कल देय' : 'Due Tomorrow')
    : (language === 'hi' ? `${days} दिन में` : `in ${days} days`);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.rowCard, pressed && styles.rowCardPressed]}>
      {/* Category color indicator strip */}
      <View style={[styles.rowAccentStrip, { backgroundColor: accent }]} />

      <View style={styles.rowBody}>
        {/* Top Header Info */}
        <View style={styles.rowTop}>
          <View style={[styles.iconContainer, { backgroundColor: accent + '18' }]}>
            <Text style={styles.rowIcon}>{task.icon || cat.icon}</Text>
          </View>

          <View style={styles.rowMid}>
            <Text style={styles.rowTitle} numberOfLines={1}>{task.title}</Text>
            <View style={styles.rowSubMeta}>
              <Text style={styles.categoryBadge}>{getCategoryLabel(task.category, language)}</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.rowFreq}>{task.frequencyLabel}</Text>
              {task.amount ? (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.rowAmount}>₹{task.amount.toLocaleString('en-IN')}</Text>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.rowRight}>
            <Text
              style={[
                styles.rowPercent,
                { color: isLateDone ? '#D97706' : theme.color },
                isLateDone && { fontSize: 13, fontFamily: 'Manrope_700Bold' },
              ]}
            >
              {percentText}
            </Text>
            <View style={[styles.dueBadge, { backgroundColor: dueStyle.bg }]}>
              <Text style={[styles.rowDueText, { color: dueStyle.text }]}>{dueLabel}</Text>
            </View>
          </View>
        </View>

        {/* Progress Bar & Status Pill */}
        <View style={styles.rowBottom}>
          <View style={styles.barSection}>
            <View style={styles.miniBarTrack}>
              <View style={[styles.miniBarFill, { width: `${barWidth}%`, backgroundColor: theme.dotColor }]} />
            </View>
          </View>

          <View style={styles.bottomMetaRow}>
            <View style={[styles.statusPillTag, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <View style={[styles.statusDot, { backgroundColor: theme.dotColor }]} />
              <Text style={[styles.statusPillTagText, { color: theme.color }]}>
                {language === 'hi' ? theme.labelHi : theme.labelEn}
              </Text>
            </View>

            {task.sharedWith.length > 0 && (
              <View style={styles.sharedBadge}>
                <AppIcon name="people-outline" size={12} color={Colors.inkSoft} />
                <Text style={styles.sharedBadgeText}>{task.sharedWith.length}</Text>
              </View>
            )}

            <View style={styles.detailsChevronBtn}>
              <Text style={styles.detailsBtnText}>{language === 'hi' ? 'विवरण' : 'Details'}</Text>
              <AppIcon name="chevron-forward" size={13} color={Colors.inkFaint} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main Modal Component ────────────────────────────────────────────────

export function TaskReportModal({ visible, onClose, tasks, language }: TaskReportModalProps) {
  const isHi = language === 'hi';
  const {
    filteredRows,
    filter, setFilter,
    sort, setSort,
    search, setSearch,
    clearFilters,
    isFiltered,
    allRows,
  } = useTaskReportState(tasks);

  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const panelAnim = useRef(new Animated.Value(0)).current;

  // Overview metrics
  const totalTasks = allRows.length;
  const onTrackCount = allRows.filter(r => r.status === 'on_track').length;
  const overdueCount = allRows.filter(r => r.status === 'overdue').length;
  const slippingCount = allRows.filter(r => r.status === 'slipping').length;

  useEffect(() => {
    Animated.timing(panelAnim, {
      toValue: selectedTaskId ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [selectedTaskId]);

  const handleClose = () => {
    setSelectedTaskId(null);
    clearFilters();
    setSearch('');
    onClose();
  };

  const handleBack = () => {
    setSelectedTaskId(null);
  };

  const selectedRow = selectedTaskId ? allRows.find(r => r.task.id === selectedTaskId) : null;

  const panelTranslateX = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  const activeCategoryKeys = new Set(tasks.map(t => t.category));
  const categoryChips = CATEGORIES.filter(c => activeCategoryKeys.has(c.key));

  // Count helper for chips
  const getFilterCount = (key: TaskStatusFilter) => {
    if (key === 'all') return allRows.length;
    if (key === 'overdue') return overdueCount;
    if (key === 'slipping') return slippingCount;
    if (key === 'on_track') return onTrackCount;
    if (key === 'no_history') return allRows.filter(r => r.status === 'no_history').length;
    if (key === 'shared') return allRows.filter(r => r.task.sharedWith.length > 0).length;
    if (key === 'finance') return allRows.filter(r => r.task.finance || (r.task.amount && r.task.amount > 0)).length;
    return allRows.filter(r => r.task.category === key).length;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>

          {/* ── LIST LAYER ─────────────────────────── */}
          <View style={styles.layer}>
            {/* Header Hero Banner */}
            <LinearGradient colors={[Colors.indigo950, Colors.indigo900]} style={styles.headerHero}>
              <View style={styles.headerTopBar}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerTitle}>{isHi ? 'कार्य विश्लेषण एवं रिपोर्ट' : 'Task Report'}</Text>
                  <Text style={styles.headerSub}>
                    {isHi ? `${totalTasks} कुल कार्य ट्रैक किए जा रहे हैं` : `Tracking performance across ${totalTasks} tasks`}
                  </Text>
                </View>
                <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
                  <AppIcon name="close" size={20} color="#FFF" />
                </Pressable>
              </View>

              {/* Stat Glance Row */}
              <View style={styles.heroStatRow}>
                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>{totalTasks}</Text>
                  <Text style={styles.heroStatLabel}>{isHi ? 'कुल कार्य' : 'Total'}</Text>
                </View>
                <View style={[styles.heroStatCard, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.12)' }]}>
                  <Text style={[styles.heroStatValue, { color: '#86EFAC' }]}>{onTrackCount}</Text>
                  <Text style={styles.heroStatLabel}>{isHi ? 'सही राह' : 'On Track'}</Text>
                </View>
                <View style={[styles.heroStatCard, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.12)' }]}>
                  <Text style={[styles.heroStatValue, { color: '#FCD34D' }]}>{slippingCount}</Text>
                  <Text style={styles.heroStatLabel}>{isHi ? 'फिसलते' : 'Slipping'}</Text>
                </View>
                <View style={[styles.heroStatCard, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.12)' }]}>
                  <Text style={[styles.heroStatValue, { color: '#FCA5A5' }]}>{overdueCount}</Text>
                  <Text style={styles.heroStatLabel}>{isHi ? 'अतिदेय' : 'Overdue'}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Search Box */}
            <View style={styles.searchContainer}>
              <View style={styles.searchRow}>
                <AppIcon name="search-outline" size={18} color={Colors.inkFaint} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={isHi ? 'नाम से खोजें...' : 'Search tasks by name...'}
                  placeholderTextColor={Colors.inkFaint}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <AppIcon name="close-circle-outline" size={18} color={Colors.inkFaint} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Filter Chips ScrollView */}
            <View style={styles.filterSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {STATUS_CHIPS.map(chip => {
                  const active = filter === chip.key;
                  const count = getFilterCount(chip.key);
                  return (
                    <Pressable
                      key={chip.key}
                      onPress={() => setFilter(chip.key)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <AppIcon
                        name={chip.icon as any}
                        size={13}
                        color={active ? '#FFF' : Colors.inkSoft}
                      />
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {isHi ? chip.labelHi : chip.labelEn}
                      </Text>
                      <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                        <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}

                <View style={styles.chipSeparator} />

                {categoryChips.map(cat => {
                  const active = filter === cat.key;
                  const count = getFilterCount(cat.key as TaskStatusFilter);
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setFilter(active ? 'all' : cat.key as TaskStatusFilter)}
                      style={[styles.chip, active && styles.chipCatActive]}
                    >
                      <Text style={styles.chipEmoji}>{cat.icon}</Text>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {isHi ? cat.labelHi : cat.labelEn}
                      </Text>
                      <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                        <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Sort & Filter Bar */}
            <View style={styles.sortBar}>
              <View style={styles.sortLeft}>
                <AppIcon name="filter-outline" size={14} color={Colors.inkFaint} />
                <Text style={styles.sortLabel}>{isHi ? 'क्रमबद्ध:' : 'Sort:'}</Text>
                <Pressable
                  onPress={() => setSort(cycleSort(sort))}
                  style={styles.sortBtn}
                >
                  <Text style={styles.sortBtnText}>{sortLabel(sort, language)}</Text>
                </Pressable>
              </View>

              {isFiltered && (
                <Pressable onPress={() => { clearFilters(); setSearch(''); }} style={styles.clearBtn}>
                  <AppIcon name="close-circle-outline" size={13} color={Colors.marigoldDeep} />
                  <Text style={styles.clearText}>{isHi ? 'फ़िल्टर साफ़ करें' : 'Reset Filters'}</Text>
                </Pressable>
              )}
            </View>

            {/* Task list */}
            <FlatList
              data={filteredRows}
              keyExtractor={r => r.task.id}
              renderItem={({ item }) => (
                <TaskRowCard
                  row={item}
                  language={language}
                  onPress={() => {
                    Keyboard.dismiss();
                    setSelectedTaskId(item.task.id);
                  }}
                />
              )}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <Text style={styles.emptyIcon}>🔍</Text>
                  </View>
                  <Text style={styles.emptyTitle}>
                    {isHi ? 'कोई कार्य नहीं मिला' : 'No matching tasks'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {isHi ? 'फ़िल्टर बदलें या अपनी खोज साफ़ करें।' : 'Try tweaking your search term or active filters.'}
                  </Text>
                  <Pressable onPress={() => { clearFilters(); setSearch(''); }} style={styles.emptyBtn}>
                    <Text style={styles.emptyBtnText}>
                      {isHi ? 'सभी फ़िल्टर साफ़ करें' : 'Clear All Filters'}
                    </Text>
                  </Pressable>
                </View>
              }
            />
          </View>

          {/* ── PANEL LAYER — slides in from right ─── */}
          {selectedRow && (
            <Animated.View
              style={[
                styles.panelLayer,
                { transform: [{ translateX: panelTranslateX }] },
              ]}
            >
              <TaskHistoryPanel
                task={selectedRow.task}
                language={language}
                onBack={handleBack}
              />
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Premium Modern Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.ivory },
  container: { flex: 1, overflow: 'hidden' },
  layer: { flex: 1, backgroundColor: Colors.ivory },

  // Panel overlay
  panelLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.ivory,
    zIndex: 10,
  },

  // Hero Banner Header
  headerHero: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 12,
    paddingBottom: 16,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 22,
    color: '#FFF',
    marginBottom: 2,
  },
  headerSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero Stat Bar
  heroStatRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroStatCard: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: '#FFF',
  },
  heroStatLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Search Box
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 7,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: Colors.ink,
    padding: 0,
  },

  // Filter Chips
  filterSection: { marginBottom: 8 },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  chipActive: {
    backgroundColor: Colors.indigo950,
    borderColor: Colors.indigo950,
  },
  chipCatActive: {
    backgroundColor: Colors.marigoldDeep,
    borderColor: Colors.marigoldDeep,
  },
  chipText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: Colors.inkSoft,
  },
  chipTextActive: { color: '#FFF' },
  chipEmoji: { fontSize: 13 },
  chipBadge: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 99,
  },
  chipBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  chipBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    color: Colors.inkSoft,
  },
  chipBadgeTextActive: { color: '#FFF' },
  chipSeparator: {
    width: 1,
    height: 22,
    backgroundColor: Colors.ivoryLine,
    marginHorizontal: 2,
  },

  // Sort Bar
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
  sortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: Colors.inkFaint,
  },
  sortBtn: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  sortBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.marigoldDeep,
  },

  // Task list
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },

  // Modern Card Styling
  rowCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    overflow: 'hidden',
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rowCardPressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  rowAccentStrip: {
    width: 5,
  },
  rowBody: {
    flex: 1,
    padding: 14,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 22 },
  rowMid: { flex: 1 },
  rowTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 15,
    color: Colors.ink,
    marginBottom: 4,
  },
  rowSubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  categoryBadge: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
    color: Colors.marigoldDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaDot: {
    fontSize: 10,
    color: Colors.inkFaint,
  },
  rowFreq: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  rowAmount: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.tealDeep,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowPercent: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  rowDueText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
  },

  // Progress Bar & Footer
  rowBottom: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.ivoryDim,
  },
  barSection: {
    marginBottom: 8,
  },
  miniBarTrack: {
    height: 5,
    backgroundColor: Colors.ivoryDim,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: 5,
    borderRadius: 3,
  },
  bottomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillTagText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10.5,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  sharedBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    color: Colors.inkSoft,
  },
  detailsChevronBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.inkFaint,
  },

  // Empty state styling
  emptyState: {
    marginTop: 50,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyIcon: { fontSize: 28 },
  emptyTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 17,
    color: Colors.ink,
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyBtn: {
    backgroundColor: Colors.indigo950,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#FFF',
  },
});
