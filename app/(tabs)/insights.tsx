import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTasks } from '@/providers/TaskProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useInsights, useHousehold, useUpcomingStrip, useSpendForecast, useMonthTrend } from '@/hooks/useInsights';
import { ProgressRing } from '@/components/ProgressRing';
import { ScreenShell, SectionHeader, EmptyState } from '@/components/ScreenShell';
import { DailyHealthCard } from '@/components/DailyHealthCard';
import { UpcomingStrip } from '@/components/UpcomingStrip';
import { SpendForecastCard } from '@/components/SpendForecastCard';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '@/components/AppIcon';
import { AccentHex, Colors, Radius } from '@/constants/theme';
import { getCategoryAccent, getCategoryLabel } from '@/constants/categoryHelpers';
import { CATEGORY_MAP } from '@/constants/categories';
import { TaskReportModal } from '@/components/TaskReportModal';
import { FinanceDetailsModal } from '@/components/FinanceDetailsModal';

export default function InsightsScreen() {
  const router = useRouter();
  const { tasks } = useTasks();
  const { translate, language } = useTranslation();
  const insights = useInsights(tasks);
  const { members } = useHousehold(tasks);
  const upcomingSlots = useUpcomingStrip(tasks);
  const forecast = useSpendForecast(tasks);
  const trend = useMonthTrend(tasks);

  const isHi = language === 'hi';
  const slipLabel = insights.slipCategory ? getCategoryLabel(insights.slipCategory, language) : null;
  const [reportOpen, setReportOpen] = useState(false);
  const [financeModalVisible, setFinanceModalVisible] = useState(false);

  // Unique categories present in tasks
  const uniqueCategoryCount = new Set(tasks.map(t => t.category)).size;

  // Streak message helpers
  function getStreakMessage(): string {
    const n = insights.streak;
    const w = insights.weeklyCompletionCount;
    if (n >= 7) return isHi ? `जोश में हैं — ${n} कार्य लगातार!` : `On a roll — ${n} tasks done in a row!`;
    if (n >= 3) return isHi ? `अच्छी लय — ${n} लगातार` : `Good momentum — ${n} in a row`;
    if (n >= 1) return isHi ? `जारी रखें — ${n} पूरे` : `Keep it going — ${n} done`;
    if (w >= 1) return isHi ? `इस हफ्ते ${w} कार्य पूरे` : `${w} tasks done this week`;
    return isHi ? 'आज एक कार्य पूरा करके शुरुआत करें' : 'Complete a task today to build momentum';
  }

  function getStreakSubtitle(): string {
    const n = insights.streak;
    const w = insights.weeklyCompletionCount;
    if (n >= 1) return isHi ? 'रोज़ाना कार्य पूरे करते रहें।' : 'Keep completing tasks to maintain momentum.';
    if (w >= 1) return isHi ? 'इस हफ्ते अच्छी शुरुआत!' : 'Great start this week!';
    return isHi ? 'किसी भी कार्य को पूर्ण करके शुरू करें।' : 'Mark any task done to get started.';
  }

  // Gate leaderboard — only show when at least 1 active non-you member
  const hasActiveHouseholdMembers = members.filter(m => !m.isYou && m.status === 'active').length >= 1;

  // Month trend message
  function getTrendText(): string | null {
    if (trend.direction === 'insufficient_data') return null;
    if (trend.direction === 'same') return isHi ? 'पिछले महीने जैसा' : 'Similar to last month';
    const arrow = trend.direction === 'up' ? '↑' : '↓';
    const label = trend.direction === 'up'
      ? isHi ? `${arrow} ${trend.lastMonthLabel} से ${trend.delta}% बेहतर` : `${arrow} ${trend.delta}% better than ${trend.lastMonthLabel}`
      : isHi ? `${arrow} ${trend.lastMonthLabel} से ${trend.delta}% कम` : `${arrow} ${trend.delta}% lower than ${trend.lastMonthLabel}`;
    return label;
  }
  const trendText = getTrendText();
  const trendIsUp = trend.direction === 'up';
  const trendIsDown = trend.direction === 'down';

  return (
    <ScreenShell title={translate('insTitle')} subtitle={translate('insSub')}>
      {insights.isEmpty && upcomingSlots.every(s => s.tasks.length === 0) ? (
        <EmptyState icon="◔" title={translate('insightsEmpty')} subtitle="" />
      ) : (
        <>
          {/* ── Priority 1: Overall Daily Health Hero Card ── */}
          <DailyHealthCard
            percent={insights.overallPercent}
            overdueCount={insights.overdueCount}
            status={insights.healthStatus}
            language={language}
          />

          {/* ── Priority 2: Task Report & Deep-Dive Explorer Entry Card ── */}
          <Pressable onPress={() => setReportOpen(true)} style={styles.allTasksCard}>
            <LinearGradient colors={[Colors.indigo950, Colors.indigo900]} style={styles.allTasksInner}>
              <View style={styles.allTasksIconBadge}>
                <Text style={styles.allTasksIconEmoji}>📋</Text>
              </View>
              <View style={styles.allTasksMid}>
                <Text style={styles.allTasksTitle}>
                  {isHi ? 'कार्य रिपोर्ट एवं विश्लेषण' : 'Task Report & Explorer'}
                </Text>
                <Text style={styles.allTasksSub}>
                  {isHi
                    ? `${tasks.length} कार्य · ${uniqueCategoryCount} श्रेणियों का पूरा इतिहास`
                    : `Explore history & analytics for all ${tasks.length} tasks`}
                </Text>
              </View>
              <View style={styles.allTasksRightBtn}>
                <Text style={styles.allTasksHint}>
                  {isHi ? 'खोलें' : 'Explore'}
                </Text>
                <AppIcon name="chevron-forward" size={14} color="#FFF" />
              </View>
            </LinearGradient>
          </Pressable>

          {/* ── Priority 3: Slip Warning Callout (High Actionability) ── */}
          {slipLabel && insights.slipCategory && insights.bars.length > 1 && (
            <Card style={styles.calloutCard} mode="outlined">
              <Card.Content style={styles.calloutContent}>
                <View style={styles.calloutHeaderRow}>
                  <View style={styles.calloutIconBadge}>
                    <AppIcon name="warning-outline" size={18} color={Colors.clayDeep} />
                  </View>
                  <View style={styles.calloutTextMid}>
                    <Text style={styles.calloutTitle}>
                      {translate('categorySlipCallout', { category: slipLabel })}
                    </Text>
                    <Text style={styles.calloutBody}>{translate('categorySlipBody')}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/(tabs)')}
                  style={styles.fixItBtn}
                >
                  <Text style={styles.fixItText}>
                    {isHi ? `${slipLabel} कार्य देखें →` : `Fix ${slipLabel} tasks →`}
                  </Text>
                </Pressable>
              </Card.Content>
            </Card>
          )}

          {/* ── Priority 4: 14-Day Upcoming Lookahead Strip ── */}
          <SectionHeader label={isHi ? 'आने वाले कार्य (14 दिन)' : 'Coming Up (14-Day Lookahead)'} />
          <UpcomingStrip
            slots={upcomingSlots}
            language={language}
            onTaskPress={(_taskId) => {
              router.push('/(tabs)');
            }}
          />

          {/* ── Priority 5: Monthly Spend & Expense Forecast ── */}
          <SectionHeader label={isHi ? 'मासिक खर्च अनुमान' : 'Monthly Spend Forecast'} />
          <SpendForecastCard
            forecast={forecast}
            language={language}
            onPress={() => setFinanceModalVisible(true)}
          />

          {/* ── Priority 6: Overall Performance & Task Metrics ── */}
          <SectionHeader label={isHi ? 'प्रदर्शन एवं कार्य सारांश' : 'Performance Overview'} />

          {/* Month Trend Badge if available */}
          {trendText && (
            <Card
              style={[
                styles.trendCard,
                trendIsUp && styles.trendCardUp,
                trendIsDown && styles.trendCardDown,
              ]}
              mode="outlined"
            >
              <Card.Content style={styles.trendContent}>
                <AppIcon
                  name={trendIsUp ? "trending-up-outline" as any : "trending-down-outline" as any}
                  size={18}
                  color={trendIsUp ? '#16A34A' : Colors.clay}
                />
                <Text
                  style={[
                    styles.trendText,
                    trendIsUp && { color: '#16A34A' },
                    trendIsDown && { color: Colors.clay },
                  ]}
                >
                  {trendText}
                </Text>
              </Card.Content>
            </Card>
          )}

          {/* Side-by-Side Ring & Metric Grid */}
          <View style={styles.gridRow}>
            {/* Progress Ring Card */}
            <Card style={styles.ringCard} mode="elevated">
              <Card.Content style={styles.ringContent}>
                <View style={styles.ringContainer}>
                  <ProgressRing percent={insights.overallPercent} color={Colors.marigold} size={106} stroke={9} />
                  <View style={styles.ringTextCenter}>
                    <Text style={styles.ringPctText}>{insights.overallPercent}%</Text>
                  </View>
                </View>
                <Text style={styles.cap}>{translate('onTimeThisMonth')}</Text>
              </Card.Content>
            </Card>

            {/* Task Summary Metrics Card */}
            <Card style={styles.metricsCard} mode="elevated">
              <Card.Content style={styles.metricsContent}>
                <Text style={styles.metricsHeader}>{isHi ? 'कार्य सारांश' : 'Task Summary'}</Text>
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{insights.activeTasksCount}</Text>
                    <Text style={styles.metricLabel}>{isHi ? 'सक्रिय' : 'Active'}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: '#16A34A' }]}>{insights.completionsCount}</Text>
                    <Text style={styles.metricLabel}>{isHi ? 'पूर्ण' : 'Completed'}</Text>
                  </View>
                </View>
                <View style={[styles.metricsRow, { marginTop: 10 }]}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{insights.skippedCount}</Text>
                    <Text style={styles.metricLabel}>{isHi ? 'छोड़े' : 'Skipped'}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.tealDeep }]}>{insights.overallPercent}%</Text>
                    <Text style={styles.metricLabel}>{isHi ? 'सफलता दर' : 'Accuracy'}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>

          {/* ── Priority 7: Category Breakdowns ── */}
          <SectionHeader label={translate('byCategory')} />
          {insights.bars.map((bar) => {
            const cat = CATEGORY_MAP[bar.key] ?? CATEGORY_MAP['home'];
            const accent = AccentHex[getCategoryAccent(bar.key)];
            return (
              <Card key={bar.key} style={styles.barCard} mode="elevated">
                <Card.Content style={styles.barContent}>
                  <View style={styles.barTop}>
                    <View style={styles.barTitleRow}>
                      <Text style={styles.barCatEmoji}>{cat.icon}</Text>
                      <Text style={styles.barCat}>{bar.label}</Text>
                    </View>
                    <View style={[styles.barValBadge, { backgroundColor: accent + '18' }]}>
                      <Text style={[styles.barVal, { color: accent }]}>{bar.percent}%</Text>
                    </View>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${bar.percent}%`, backgroundColor: accent },
                      ]}
                    />
                  </View>
                </Card.Content>
              </Card>
            );
          })}

          {/* ── Priority 8: Household Contribution Leaderboard (Gated) ── */}
          {hasActiveHouseholdMembers && (
            <>
              <SectionHeader label={isHi ? 'गृहस्थी का योगदान' : 'Household Contribution'} />
              <Card style={styles.leaderboardCard} mode="elevated">
                <Card.Content style={styles.leaderboardContent}>
                  {members.map((m, idx) => {
                    const key = m.isYou ? 'you' : (m.code || m.userId || m.name);
                    return (
                      <View key={key} style={styles.leaderboardRow}>
                        <Text style={styles.rankNum}>#{idx + 1}</Text>
                        <View style={[styles.avatar, { backgroundColor: m.color || Colors.marigold }]}>
                          <Text style={styles.avatarText}>{m.short}</Text>
                        </View>
                        <View style={styles.leaderboardInfo}>
                          <View style={styles.leaderboardTopLine}>
                            <Text style={styles.leaderboardName}>
                              {m.name} {m.isYou ? (isHi ? '(आप)' : '(You)') : ''}
                            </Text>
                            <Text style={styles.leaderboardStatText}>
                              {m.onTimePercent}% {isHi ? 'समय पर' : 'on-time'} · {m.taskCount} {isHi ? 'कार्य' : 'tasks'}
                            </Text>
                          </View>
                          <View style={styles.leaderboardBarTrack}>
                            <View
                              style={[
                                styles.leaderboardBarFill,
                                { width: `${m.onTimePercent}%`, backgroundColor: m.color || Colors.marigold },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </Card.Content>
              </Card>
            </>
          )}

          {/* ── Priority 9: Habit Momentum & Weekly Heatmap ── */}
          <SectionHeader label={isHi ? 'आदत और गतिशीलता' : 'Momentum & Habit History'} />

          {/* Streak Reframe Card */}
          <Card style={styles.streakCard} mode="elevated">
            <Card.Content style={styles.streakContent}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <View style={styles.streakTextContainer}>
                <Text style={styles.streakTitle}>{getStreakMessage()}</Text>
                <Text style={styles.streakSub}>{getStreakSubtitle()}</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Weekly Heatmap Card */}
          <Card style={styles.heatmapCard} mode="elevated">
            <Card.Content style={styles.heatmapContent}>
              {insights.weeklyActivity.map((activity, idx) => (
                <View key={idx} style={styles.dayCol}>
                  <Text style={[styles.dayLabel, activity.isToday && styles.dayLabelToday]}>
                    {activity.dayName}
                  </Text>
                  <View
                    style={[
                      styles.dayCircle,
                      activity.hasCompletion && styles.dayCircleCompleted,
                      activity.isToday && !activity.hasCompletion && styles.dayCircleToday,
                    ]}
                  >
                    {activity.hasCompletion ? (
                      <Text style={styles.checkText}>✓</Text>
                    ) : activity.isToday ? (
                      <View style={styles.todayIndicator} />
                    ) : null}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        </>
      )}

      {/* Task Report Modal */}
      <TaskReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        tasks={tasks}
        language={language}
      />

      {/* Finance Details & Spend Breakdown Modal */}
      <FinanceDetailsModal
        visible={financeModalVisible}
        onClose={() => setFinanceModalVisible(false)}
        tasks={tasks}
        language={language}
        translate={translate}
      />
    </ScreenShell>
  );
}

// ─── Enhanced Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Task Report Entry Card (Priority 2)
  allTasksCard: {
    borderRadius: Radius.md,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  allTasksInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  allTasksIconBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTasksIconEmoji: { fontSize: 22 },
  allTasksMid: { flex: 1 },
  allTasksTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 15,
    color: '#FFF',
    marginBottom: 2,
  },
  allTasksSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.7)',
  },
  allTasksRightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  allTasksHint: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: '#FFF',
  },

  // Category Slip Callout Card (Priority 3)
  calloutCard: {
    backgroundColor: 'rgba(193,80,46,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(193,80,46,0.25)',
    borderRadius: Radius.md,
    marginBottom: 16,
  },
  calloutContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  calloutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  calloutIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(193,80,46,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  calloutTextMid: { flex: 1 },
  calloutTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 14,
    color: Colors.clayDeep,
    marginBottom: 2,
  },
  calloutBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12.5,
    color: Colors.clayDeep,
    lineHeight: 18,
  },
  fixItBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: Colors.clayDeep,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  fixItText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11.5,
    color: '#FFF',
  },

  // Month Trend Badge
  trendCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    borderColor: Colors.ivoryLine,
    borderWidth: 1,
  },
  trendCardUp: { borderColor: 'rgba(22,163,74,0.3)', backgroundColor: 'rgba(22,163,74,0.06)' },
  trendCardDown: { borderColor: 'rgba(193,80,46,0.25)', backgroundColor: 'rgba(193,80,46,0.06)' },
  trendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  trendText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.inkSoft,
  },

  // Side by Side Grid Cards
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  ringCard: {
    flex: 1.1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1.5,
    overflow: 'hidden',
  },
  ringContent: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  ringContainer: {
    width: 106,
    height: 106,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringTextCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringPctText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    color: Colors.ink,
  },
  cap: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },

  metricsCard: {
    flex: 1.2,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1.5,
    overflow: 'hidden',
  },
  metricsContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  metricsHeader: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.inkFaint,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricItem: { flex: 1 },
  metricValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.marigoldDeep,
  },
  metricLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10.5,
    color: Colors.inkSoft,
    marginTop: 1,
  },

  // Category Bars
  barCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1,
  },
  barContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  barTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  barTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barCatEmoji: { fontSize: 14 },
  barCat: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  barValBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  barVal: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 12,
  },
  barTrack: {
    height: 7,
    backgroundColor: Colors.ivoryDim,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Leaderboard Card
  leaderboardCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1.5,
  },
  leaderboardContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankNum: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 12,
    color: Colors.inkFaint,
    width: 20,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    color: Colors.white,
    fontFamily: 'Manrope_800ExtraBold',
  },
  leaderboardInfo: { flex: 1, gap: 4 },
  leaderboardTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaderboardName: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: Colors.ink,
  },
  leaderboardStatText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  leaderboardBarTrack: {
    height: 6,
    backgroundColor: Colors.ivoryDim,
    borderRadius: 3,
    overflow: 'hidden',
  },
  leaderboardBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Streak & Heatmap Cards
  streakCard: {
    backgroundColor: '#FFF8EC',
    borderWidth: 1,
    borderColor: '#F9E5C9',
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 1,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  streakEmoji: { fontSize: 26 },
  streakTextContainer: { flex: 1 },
  streakTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 15,
    color: Colors.indigo950,
  },
  streakSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 1,
  },

  heatmapCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    marginBottom: 24,
    elevation: 1,
  },
  heatmapContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: Colors.inkSoft,
  },
  dayLabelToday: { color: Colors.marigoldDeep, fontFamily: 'Manrope_800ExtraBold' },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleCompleted: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  dayCircleToday: { borderColor: Colors.marigold },
  checkText: { color: Colors.white, fontSize: 11, fontFamily: 'Manrope_800ExtraBold' },
  todayIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.marigold },
});
