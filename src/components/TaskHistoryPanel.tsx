import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { CompletionStatus, RepeatingTask } from '@/types';
import { CATEGORY_MAP } from '@/constants/categories';
import { AccentHex, Colors, Radius } from '@/constants/theme';
import { getCategoryAccent, getCategoryLabel } from '@/constants/categoryHelpers';
import { daysUntilDue } from '@/domain/recurrence';
import { AppIcon } from '@/components/AppIcon';
import { computeTaskStats } from '@/domain/taskReport';

interface TaskHistoryPanelProps {
  task: RepeatingTask;
  language: 'en' | 'hi';
  onBack: () => void;
}

// ─── History status visuals ───────────────────────────────────────────────

function getHistoryStatusTheme(s: CompletionStatus) {
  if (s === 'on_time') {
    return { icon: '✅', color: '#15803D', bg: '#DCFCE7', border: '#86EFAC', labelEn: 'On time', labelHi: 'समय पर' };
  }
  if (s === 'late') {
    return { icon: '⚠️', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A', labelEn: 'Late', labelHi: 'देर से' };
  }
  if (s === 'missed') {
    return { icon: '🚫', color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5', labelEn: 'Missed', labelHi: 'छूट गया' };
  }
  if (s === 'skipped') {
    return { icon: '⏩', color: Colors.inkSoft, bg: Colors.surfaceMuted, border: Colors.ivoryLine, labelEn: 'Skipped', labelHi: 'छोड़ा' };
  }
  if (s === 'snoozed') {
    return { icon: '💤', color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE', labelEn: 'Snoozed', labelHi: 'स्नूज़' };
  }
  return { icon: '●', color: Colors.inkSoft, bg: Colors.surfaceMuted, border: Colors.ivoryLine, labelEn: s, labelHi: s };
}

function formatDateTime(iso?: string, lang?: 'en' | 'hi'): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: undefined,
    }) + ', ' + d.toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export function TaskHistoryPanel({ task, language, onBack }: TaskHistoryPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const isHi = language === 'hi';

  const cat = CATEGORY_MAP[task.category] ?? CATEGORY_MAP['home'];
  const accent = AccentHex[getCategoryAccent(task.category)];
  const catLabel = getCategoryLabel(task.category, language);
  const stats = computeTaskStats(task);

  const days = daysUntilDue(task.nextDueDate);
  const nextDueFmt = (() => {
    try {
      return new Date(task.nextDueDate).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', {
        day: 'numeric', month: 'short',
      });
    } catch { return task.nextDueDate.slice(0, 10); }
  })();

  const history = [...(task.history ?? [])].reverse();
  const INITIAL_SHOW = 6;
  const shown = showAll ? history : history.slice(0, INITIAL_SHOW);
  const hasMore = history.length > INITIAL_SHOW && !showAll;

  const onTimePercent = stats.onTimePercent;
  const barWidth = onTimePercent === -1 ? 0 : onTimePercent;
  const barColor = onTimePercent === -1 ? Colors.inkFaint
    : onTimePercent >= 75 ? '#15803D'
    : onTimePercent >= 50 ? '#B45309'
    : '#B91C1C';

  return (
    <View style={styles.root}>
      {/* ── Top Back Header Bar ──────────────────────────────── */}
      <View style={styles.backRow}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <View style={styles.backIconCircle}>
            <AppIcon name="chevron-back" size={16} color={Colors.ink} />
          </View>
          <Text style={styles.backLabel}>{isHi ? 'सभी कार्य लिस्ट' : 'All Tasks'}</Text>
        </Pressable>

        <View style={styles.headerRightBadge}>
          <Text style={styles.headerRightBadgeText}>{catLabel}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Task Hero Card ─────────────────────────── */}
        <LinearGradient colors={[Colors.indigo950, Colors.indigo900]} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconBadge, { backgroundColor: accent + '33' }]}>
              <Text style={styles.heroIcon}>{task.icon || cat.icon}</Text>
            </View>
            <View style={styles.heroMid}>
              <Text style={styles.heroTitle}>{task.title}</Text>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroCategoryText}>{catLabel}</Text>
                <Text style={styles.heroMetaDot}>•</Text>
                <Text style={styles.heroFreqText}>{task.frequencyLabel}</Text>
                {task.amount ? (
                  <>
                    <Text style={styles.heroMetaDot}>•</Text>
                    <Text style={styles.heroAmountText}>₹{task.amount.toLocaleString('en-IN')}</Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Performance At a Glance ──────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <AppIcon name="stats-chart-outline" size={16} color={Colors.inkFaint} />
          <Text style={styles.sectionLabel}>{isHi ? 'प्रदर्शन विश्लेषण' : 'Performance Analytics'}</Text>
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <AppIcon name="checkmark-circle-outline" size={16} color={barColor} />
              <Text style={styles.statKey}>{isHi ? 'समय पर दर' : 'On-time Rate'}</Text>
            </View>
            <Text style={[styles.statValue, { color: barColor }]}>
              {onTimePercent === -1 ? '—' : `${onTimePercent}%`}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <AppIcon name="checkmark-done-outline" size={16} color={Colors.tealDeep} />
              <Text style={styles.statKey}>{isHi ? 'कुल पूरा' : 'Total Completed'}</Text>
            </View>
            <Text style={styles.statValue}>{stats.totalDone}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <AppIcon name="star-outline" size={16} color={Colors.marigoldDeep} />
              <Text style={styles.statKey}>{isHi ? 'उत्कृष्ट रन' : 'Longest Streak'}</Text>
            </View>
            <Text style={styles.statValue}>{stats.longestRun}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <AppIcon name="calendar-outline" size={16} color={days < 0 ? '#B91C1C' : Colors.inkSoft} />
              <Text style={styles.statKey}>{isHi ? 'अगली तिथि' : 'Next Due'}</Text>
            </View>
            <Text style={[styles.statValue, days < 0 && { color: '#B91C1C' }]}>
              {nextDueFmt}
            </Text>
          </View>
        </View>

        {/* ── Progress bar section ─────────────────────────────── */}
        {onTimePercent !== -1 && (
          <View style={styles.progressCard}>
            <View style={styles.progressTopRow}>
              <Text style={styles.progressTitle}>{isHi ? 'समयबद्धता' : 'Punctuality Level'}</Text>
              <Text style={[styles.progressPercentText, { color: barColor }]}>{onTimePercent}%</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.barCaption}>
              {isHi
                ? `${stats.monthsTracked} महीनों के ट्रैक रिकॉर्ड में ${onTimePercent}% सफलता दर`
                : `${onTimePercent}% accuracy across ${stats.monthsTracked} tracked month${stats.monthsTracked !== 1 ? 's' : ''}`}
            </Text>
          </View>
        )}

        {/* ── Skipped note banner ────────────────────── */}
        {stats.totalSkipped > 0 && (
          <View style={styles.skippedBanner}>
            <AppIcon name="information-circle-outline" size={15} color={Colors.inkSoft} />
            <Text style={styles.skippedNote}>
              {isHi
                ? `${stats.totalSkipped} बार कार्य छोड़ा गया (दर गणना से बाहर)`
                : `${stats.totalSkipped} intentional skips (excluded from failure rate)`}
            </Text>
          </View>
        )}

        {/* ── History timeline section ─────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <AppIcon name="time-outline" size={16} color={Colors.inkFaint} />
          <Text style={styles.sectionLabel}>{isHi ? 'पूर्णता इतिहास' : 'Completion Timeline'}</Text>
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryIcon}>📜</Text>
            <Text style={styles.emptyHistoryTitle}>{isHi ? 'अभी कोई इतिहास नहीं' : 'No completion log yet'}</Text>
            <Text style={styles.emptyHistoryText}>
              {isHi
                ? 'इस कार्य को पूरा करने के बाद आपका इतिहास यहाँ रिकॉर्ड होगा।'
                : 'Completing this recurring task will populate your analytics timeline here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {shown.map((entry, idx) => {
              const theme = getHistoryStatusTheme(entry.status);
              return (
                <View key={idx} style={styles.timelineItem}>
                  {/* Timeline connector axis */}
                  <View style={styles.timelineAxis}>
                    <View style={[styles.timelineDot, { backgroundColor: theme.color }]} />
                    {idx < shown.length - 1 && <View style={styles.timelineLine} />}
                  </View>

                  {/* Entry Card */}
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineCardTop}>
                      <Text style={styles.timelineMonth}>{entry.month}</Text>
                      <View style={[styles.statusPill, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={styles.statusPillIcon}>{theme.icon}</Text>
                        <Text style={[styles.statusPillText, { color: theme.color }]}>
                          {isHi ? theme.labelHi : theme.labelEn}
                        </Text>
                      </View>
                    </View>

                    {entry.completedAt && (
                      <View style={styles.dateMetaRow}>
                        <AppIcon name="calendar-outline" size={12} color={Colors.inkFaint} />
                        <Text style={styles.timelineDate}>
                          {formatDateTime(entry.completedAt, language)}
                        </Text>
                      </View>
                    )}

                    {entry.note && (
                      <View style={styles.noteContainer}>
                        <AppIcon name="chatbox-ellipses-outline" size={12} color={Colors.inkSoft} />
                        <Text style={styles.noteText}>{entry.note}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {hasMore && (
              <Pressable onPress={() => setShowAll(true)} style={styles.showMoreBtn}>
                <Text style={styles.showMoreText}>
                  {isHi ? `+ ${history.length - INITIAL_SHOW} और एंट्री देखें` : `+ Show ${history.length - INITIAL_SHOW} More Entries`}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Shared Members Section ──────────────────────────────── */}
        {task.sharedWith.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <View style={styles.sectionHeaderRow}>
              <AppIcon name="people-outline" size={16} color={Colors.inkFaint} />
              <Text style={styles.sectionLabel}>{isHi ? 'साझा सदस्य' : 'Shared Members'}</Text>
            </View>

            <View style={styles.sharedRow}>
              {task.sharedWith.map((m, i) => (
                <View key={i} style={[styles.sharedPill, { backgroundColor: Colors.white }]}>
                  <View style={[styles.sharedAvatar, { backgroundColor: m.color || Colors.indigo950 }]}>
                    <Text style={styles.sharedAvatarText}>
                      {(m.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.sharedName}>{m.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ivory },

  // Header Back Bar
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    backgroundColor: Colors.white,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.ink,
  },
  headerRightBadge: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  headerRightBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.marigoldDeep,
    textTransform: 'uppercase',
  },

  scroll: { padding: 16 },

  // Hero Card
  heroCard: {
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 20,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIconBadge: {
    width: 50,
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: { fontSize: 28 },
  heroMid: { flex: 1 },
  heroTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: '#FFF',
    marginBottom: 4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  heroCategoryText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.marigoldLight,
    textTransform: 'uppercase',
  },
  heroMetaDot: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  heroFreqText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  heroAmountText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#86EFAC',
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Stat Grid Cards
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statKey: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  statValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.ink,
  },

  // Progress Level Card
  progressCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginBottom: 16,
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  progressPercentText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
  },
  barTrack: {
    height: 8,
    backgroundColor: Colors.ivoryDim,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: { height: 8, borderRadius: 4 },
  barCaption: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkSoft,
  },

  // Skipped Banner
  skippedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.sm,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  skippedNote: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.inkSoft,
    flex: 1,
  },

  // Timeline Container
  timelineContainer: {
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineAxis: {
    alignItems: 'center',
    width: 16,
    paddingTop: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.ivoryLine,
    marginVertical: 4,
    minHeight: 24,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginBottom: 10,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  timelineCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelineMonth: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 14,
    color: Colors.ink,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillIcon: { fontSize: 10 },
  statusPillText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
  },
  dateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timelineDate: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkFaint,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Colors.surfaceMuted,
    padding: 8,
    borderRadius: Radius.xs,
    marginTop: 8,
  },
  noteText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.inkSoft,
    flex: 1,
    lineHeight: 16,
  },

  showMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginTop: 4,
  },
  showMoreText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.marigoldDeep,
  },

  // Shared Members
  sharedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  sharedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  sharedAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharedAvatarText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 11,
    color: '#fff',
  },
  sharedName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
  },

  emptyHistory: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  emptyHistoryIcon: { fontSize: 32, marginBottom: 8 },
  emptyHistoryTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 15,
    color: Colors.ink,
    marginBottom: 4,
  },
  emptyHistoryText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12.5,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
  },
});
