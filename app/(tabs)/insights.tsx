import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useTasks } from '@/providers/TaskProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useInsights, useHousehold } from '@/hooks/useInsights';
import { ProgressRing } from '@/components/ProgressRing';
import { ScreenShell, SectionHeader, EmptyState } from '@/components/ScreenShell';
import { AccentHex, Colors, Radius, Typography } from '@/constants/theme';
import { getCategoryAccent, getCategoryLabel } from '@/constants/categoryHelpers';

export default function InsightsScreen() {
  const { tasks } = useTasks();
  const { translate, language } = useTranslation();
  const insights = useInsights(tasks);
  const { members } = useHousehold(tasks);

  const slipLabel = insights.slipCategory ? getCategoryLabel(insights.slipCategory, language) : null;

  return (
    <ScreenShell title={translate('insTitle')} subtitle={translate('insSub')}>
      {insights.isEmpty ? (
        <EmptyState icon="◔" title={translate('insightsEmpty')} subtitle="" />
      ) : (
        <>
          {/* 🔥 Completion Streak Banner */}
          <Card style={styles.streakCard} mode="elevated">
            <Card.Content style={styles.streakContent}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <View style={styles.streakTextContainer}>
                <Text style={styles.streakTitle}>
                  {insights.streak > 0
                    ? language === 'hi'
                      ? `${insights.streak} दिनों का लगातार सिलसिला!`
                      : `${insights.streak} Day Completion Streak!`
                    : language === 'hi'
                    ? 'कार्य पूरा करना शुरू करें!'
                    : 'Start completing tasks!'}
                </Text>
                <Text style={styles.streakSub}>
                  {insights.streak > 0
                    ? language === 'hi'
                      ? 'लगातार कार्य पूरे करते रहें।'
                      : 'Keep completing tasks daily to grow your streak.'
                    : language === 'hi'
                    ? 'सिलसिला शुरू करने के लिए आज कोई कार्य पूरा करें।'
                    : 'Complete a task today to start your streak.'}
                </Text>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.gridRow}>
            {/* Progress Ring Card */}
            <Card style={styles.ringCard} mode="elevated">
              <Card.Content style={styles.ringContent}>
                <View style={styles.ringContainer}>
                  <ProgressRing percent={insights.overallPercent} color={Colors.marigold} size={110} stroke={9} />
                  <View style={styles.ringTextCenter}>
                    <Text style={styles.ringPctText}>{insights.overallPercent}%</Text>
                  </View>
                </View>
                <Text style={styles.cap}>{translate('onTimeThisMonth')}</Text>
              </Card.Content>
            </Card>

            {/* Task Summary Card */}
            <Card style={styles.metricsCard} mode="elevated">
              <Card.Content style={styles.metricsContent}>
                <Text style={styles.metricsHeader}>{language === 'hi' ? 'कार्य सारांश' : 'Task Summary'}</Text>
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{insights.activeTasksCount}</Text>
                    <Text style={styles.metricLabel}>{language === 'hi' ? 'सक्रिय कार्य' : 'Active Tasks'}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{insights.completionsCount}</Text>
                    <Text style={styles.metricLabel}>{language === 'hi' ? 'कुल पूर्ण' : 'Completions'}</Text>
                  </View>
                </View>
                <View style={[styles.metricsRow, { marginTop: 10 }]}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{insights.skippedCount}</Text>
                    <Text style={styles.metricLabel}>{language === 'hi' ? 'छोड़े गए' : 'Skipped'}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricValue, { color: Colors.tealDeep }]}>{insights.overallPercent}%</Text>
                    <Text style={styles.metricLabel}>{language === 'hi' ? 'समय पर दर' : 'On-time Rate'}</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>

          {/* Weekly Heatmap */}
          <SectionHeader label={translate('weeklyActivity')} />
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

          {/* 👥 Household Leaderboard */}
          {members && members.length > 0 && (
            <>
              <SectionHeader label={language === 'hi' ? 'गृहस्थी का योगदान' : 'Household Contribution'} />
              <Card style={styles.leaderboardCard} mode="elevated">
                <Card.Content style={styles.leaderboardContent}>
                  {members.map((m) => (
                    <View key={m.name} style={styles.leaderboardRow}>
                      <View style={[styles.avatar, { backgroundColor: m.color || Colors.marigold }]}>
                        <Text style={styles.avatarText}>{m.short}</Text>
                      </View>
                      <View style={styles.leaderboardInfo}>
                        <View style={styles.leaderboardTopLine}>
                          <Text style={styles.leaderboardName}>
                            {m.name} {m.isYou ? (language === 'hi' ? '(आप)' : '(You)') : ''}
                          </Text>
                          <Text style={styles.leaderboardStatText}>
                            {m.onTimePercent}% {language === 'hi' ? 'समय पर' : 'on-time'} · {m.taskCount} {language === 'hi' ? 'कार्य' : 'tasks'}
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
                  ))}
                </Card.Content>
              </Card>
            </>
          )}

          {/* By Category */}
          <SectionHeader label={translate('byCategory')} />
          {insights.bars.map((bar) => (
            <Card key={bar.key} style={styles.barCard} mode="elevated">
              <Card.Content style={styles.barContent}>
                <View style={styles.barTop}>
                  <Text style={styles.barCat}>{bar.label}</Text>
                  <Text style={styles.barVal}>{bar.percent}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${bar.percent}%`, backgroundColor: AccentHex[getCategoryAccent(bar.key)] },
                    ]}
                  />
                </View>
              </Card.Content>
            </Card>
          ))}

          {/* Slip Category Alert callout */}
          {slipLabel && insights.slipCategory && insights.bars.length > 1 && (
            <Card style={styles.calloutCard} mode="outlined">
              <Card.Content>
                <Text style={styles.calloutTitle}>⚠ {translate('categorySlipCallout', { category: slipLabel })}</Text>
                <Text style={styles.calloutBody}>{translate('categorySlipBody')}</Text>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  streakCard: {
    backgroundColor: '#FFF8EC',
    borderWidth: 1,
    borderColor: '#F9E5C9',
    borderRadius: Radius.md,
    marginBottom: 16,
    elevation: 1,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  streakEmoji: {
    fontSize: 28,
  },
  streakTextContainer: {
    flex: 1,
  },
  streakTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 16,
    color: Colors.indigo950,
  },
  streakSub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  ringCard: {
    flex: 1.1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    elevation: 1.5,
    overflow: 'hidden',
  },
  ringContent: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  ringContainer: {
    width: 110,
    height: 110,
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
    fontSize: 26,
    color: Colors.ink,
  },
  cap: { ...Typography.bodySm, fontSize: 11.5, color: Colors.inkSoft, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  metricsCard: {
    flex: 1.2,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    elevation: 1.5,
    overflow: 'hidden',
  },
  metricsContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  metricsHeader: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.ink,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricItem: {
    flex: 1,
  },
  metricValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.marigoldDeep,
  },
  metricLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  heatmapCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 14,
    elevation: 1.5,
  },
  heatmapContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { ...Typography.caption, fontSize: 11, color: Colors.inkSoft },
  dayLabelToday: { color: Colors.marigoldDeep, fontFamily: 'Manrope_800ExtraBold' },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.ivoryLine,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleCompleted: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  dayCircleToday: { borderColor: Colors.marigold },
  checkText: { color: Colors.white, fontSize: 11, fontFamily: 'Manrope_800ExtraBold', lineHeight: 14 },
  todayIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.marigold },
  leaderboardCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 14,
    elevation: 1.5,
  },
  leaderboardContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  leaderboardInfo: {
    flex: 1,
    gap: 6,
  },
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
  barCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    marginBottom: 10,
    elevation: 1.5,
  },
  barContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  barCat: { ...Typography.title, fontSize: 13, color: Colors.ink },
  barVal: { ...Typography.caption, color: Colors.inkSoft },
  barTrack: { height: 8, backgroundColor: Colors.ivoryDim, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  calloutCard: {
    backgroundColor: 'rgba(193,80,46,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(193,80,46,0.2)',
    borderRadius: Radius.md,
    marginTop: 8,
  },
  calloutTitle: { ...Typography.title, fontSize: 13, color: Colors.clayDeep, marginBottom: 4 },
  calloutBody: { ...Typography.bodySm, color: Colors.clayDeep, lineHeight: 19 },
});
