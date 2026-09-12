import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Colors, Radius, Typography } from '@/constants/theme';
import { getCategoryLabel } from '@/constants/categoryHelpers';
import type { ConsistencyDay, WeeklyVelocity } from '@/domain/insights';

interface HabitConsistencyHeatmapProps {
  streak: number;
  matrix: ConsistencyDay[];
  velocity: WeeklyVelocity;
  language: 'en' | 'hi';
}

export function HabitConsistencyHeatmap({
  streak,
  matrix,
  velocity,
  language,
}: HabitConsistencyHeatmapProps) {
  const router = useRouter();
  const isHi = language === 'hi';

  const rows = React.useMemo(() => {
    const r: ConsistencyDay[][] = [];
    for (let i = 0; i < matrix.length; i += 7) {
      r.push(matrix.slice(i, i + 7));
    }
    return r;
  }, [matrix]);

  const intensityColors = [
    Colors.ivoryDim,                 // 0: No tasks completed
    'rgba(232, 163, 61, 0.45)',     // 1: 1 task completed
    Colors.marigold,                 // 2: 2 tasks completed
    Colors.tealDeep,                 // 3: 3+ tasks completed
  ];

  // Streak copy
  function getStreakTitle(): string {
    if (streak >= 14) return isHi ? `शानदार! ${streak} दिन की स्ट्रीक 🔥` : `Unstoppable! ${streak}-Day Streak 🔥`;
    if (streak >= 7) return isHi ? `बढ़िया गति! ${streak} दिन की स्ट्रीक 🔥` : `Great Momentum! ${streak}-Day Streak 🔥`;
    if (streak >= 1) return isHi ? `${streak} दिन की सक्रिय स्ट्रीक 🔥` : `${streak}-Day Active Streak 🔥`;
    return isHi ? 'नई स्ट्रीक शुरू करें 🌱' : 'Start a New Streak 🌱';
  }

  function getStreakSub(): string {
    if (streak >= 7) {
      return isHi
        ? 'आप लगातार अपनी आदतों को बनाए रख रहे हैं। बहुत खूब!'
        : 'You are showing incredible consistency. Keep the fire burning!';
    }
    if (streak >= 1) {
      return isHi
        ? 'आज एक कार्य पूरा करके अपनी स्ट्रीक बरकरार रखें!'
        : 'Complete a task today to keep your daily chain alive!';
    }
    return isHi
      ? 'आज किसी कार्य को पूर्ण करें और पहली स्ट्रीक बनाएं।'
      : 'Mark any task complete today to spark your daily habit!';
  }

  const slipCategoryName = velocity.slipCategory
    ? getCategoryLabel(velocity.slipCategory, language)
    : null;

  return (
    <View style={styles.container}>
      {/* ── 1. Hero Streak Card ── */}
      <Card style={styles.streakHeroCard} mode="elevated">
        <Card.Content style={styles.streakHeroContent}>
          <View style={styles.streakLeft}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeEmoji}>🔥</Text>
            </View>
            <View style={styles.streakTextCol}>
              <Text style={styles.streakTitle}>{getStreakTitle()}</Text>
              <Text style={styles.streakSub}>{getStreakSub()}</Text>
            </View>
          </View>
          {streak > 0 && (
            <View style={styles.streakNumPill}>
              <Text style={styles.streakNumText}>{streak}</Text>
              <Text style={styles.streakNumUnit}>{isHi ? 'दिन' : 'days'}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* ── 2. 28-Day Habit Consistency Grid ── */}
      <Card style={styles.matrixCard} mode="elevated">
        <Card.Content style={styles.matrixContent}>
          <View style={styles.matrixHeader}>
            <Text style={styles.matrixTitle}>
              {isHi ? '28-दिन आदत निरंतरता ग्रिड' : '28-Day Consistency Matrix'}
            </Text>
            <Text style={styles.matrixSubtitle}>
              {isHi ? 'पिछले 4 हफ्तों का विवरण' : 'Last 4 weeks daily activity'}
            </Text>
          </View>

          {/* 4 Weekly Rows of 7 Days */}
          <View style={styles.gridContainer}>
            {/* Weekday Column Headers */}
            <View style={styles.weekHeaderRow}>
              {(rows[0] ?? []).map((day, colIdx) => (
                <View key={colIdx} style={styles.colHeaderCell}>
                  <Text style={styles.colHeaderText}>{day.dayLabel.slice(0, 1)}</Text>
                </View>
              ))}
            </View>

            {rows.map((week, rowIdx) => (
              <View key={rowIdx} style={styles.weekRow}>
                {week.map((day, colIdx) => {
                  const bg = intensityColors[day.intensity];
                  return (
                    <View
                      key={`${day.dateStr}-${colIdx}`}
                      style={[
                        styles.daySquare,
                        { backgroundColor: bg },
                        day.isToday && styles.todaySquare,
                      ]}
                    >
                      {day.isToday && <View style={styles.todayDot} />}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <Text style={styles.legendLabel}>{isHi ? 'कम' : 'Less'}</Text>
            <View style={styles.legendBlocks}>
              {intensityColors.map((color, i) => (
                <View
                  key={i}
                  style={[styles.legendBox, { backgroundColor: color }]}
                />
              ))}
            </View>
            <Text style={styles.legendLabel}>{isHi ? 'अधिक' : 'More'}</Text>
          </View>
        </Card.Content>
      </Card>

      {/* ── 3. Weekly Velocity & Top Habit ── */}
      <View style={styles.velocityRow}>
        <View style={styles.velocityCard}>
          <Text style={styles.velocityValue}>{velocity.completedThisWeek}</Text>
          <Text style={styles.velocityLabel}>
            {isHi ? 'इस हफ्ते पूरे' : 'Done This Week'}
          </Text>
        </View>

        <View style={styles.velocityCard}>
          <Text
            style={[
              styles.velocityValue,
              velocity.skippedThisWeek > 0 && { color: Colors.clay },
            ]}
          >
            {velocity.skippedThisWeek}
          </Text>
          <Text style={styles.velocityLabel}>
            {isHi ? 'छोड़े गए' : 'Skipped'}
          </Text>
        </View>

        <View style={[styles.velocityCard, styles.velocityCardHighlight]}>
          <Text style={styles.topHabitIcon}>⭐</Text>
          <Text style={styles.topHabitTitle} numberOfLines={1}>
            {velocity.topHabitTitle ?? (isHi ? 'कोई नहीं' : 'None yet')}
          </Text>
          <Text style={styles.velocityLabel}>
            {isHi ? 'शीर्ष आदत' : 'Top Habit'}
          </Text>
        </View>
      </View>

      {/* ── 4. Slip Alert Catch-Up Card (if category slipping) ── */}
      {slipCategoryName && (
        <Card style={styles.slipCard} mode="outlined">
          <Card.Content style={styles.slipContent}>
            <View style={styles.slipTop}>
              <Text style={styles.slipEmoji}>⚠️</Text>
              <View style={styles.slipTextCol}>
                <Text style={styles.slipTitle}>
                  {isHi
                    ? `${slipCategoryName} पर ध्यान दें`
                    : `${slipCategoryName} is slipping`}
                </Text>
                <Text style={styles.slipSub}>
                  {isHi
                    ? 'हाल ही में इस श्रेणी के कार्य छूटे हैं। आज इसे पूरा करें।'
                    : 'A few recent tasks in this category were skipped or overdue.'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)')}
              style={styles.catchUpBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.catchUpBtnText}>
                {isHi ? 'कार्य सूची देखें →' : 'Catch Up on Tasks →'}
              </Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 4,
  },
  // Hero Streak Card
  streakHeroCard: {
    backgroundColor: '#FFF9EE',
    borderWidth: 1,
    borderColor: '#F9E5C9',
    borderRadius: Radius.md,
    elevation: 1.5,
  },
  streakHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  streakBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(232, 163, 61, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakBadgeEmoji: {
    fontSize: 22,
  },
  streakTextCol: {
    flex: 1,
  },
  streakTitle: {
    ...Typography.body,
    fontFamily: 'Fraunces_700Bold',
    fontSize: 15,
    color: Colors.indigo950,
  },
  streakSub: {
    ...Typography.caption,
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
    lineHeight: 16,
  },
  streakNumPill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.indigo950,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 48,
  },
  streakNumText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.white,
    lineHeight: 22,
  },
  streakNumUnit: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },

  // 28-Day Matrix Card
  matrixCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    elevation: 1,
  },
  matrixContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  matrixHeader: {
    marginBottom: 14,
  },
  matrixTitle: {
    ...Typography.body,
    fontFamily: 'Fraunces_700Bold',
    fontSize: 14,
    color: Colors.ink,
  },
  matrixSubtitle: {
    ...Typography.caption,
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: Colors.inkFaint,
    marginTop: 2,
  },
  gridContainer: {
    paddingVertical: 6,
    gap: 6,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
    paddingHorizontal: 1,
  },
  colHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  colHeaderText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  daySquare: {
    flex: 1,
    height: 32,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaySquare: {
    borderColor: Colors.marigoldDeep,
    borderWidth: 2,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.marigoldDeep,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  legendLabel: {
    ...Typography.caption,
    fontFamily: 'Manrope_500Medium',
    fontSize: 10,
    color: Colors.inkFaint,
  },
  legendBlocks: {
    flexDirection: 'row',
    gap: 4,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },

  // Velocity Cards Row
  velocityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  velocityCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    elevation: 1,
  },
  velocityCardHighlight: {
    backgroundColor: '#F9F8F5',
  },
  velocityValue: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.tealDeep,
  },
  velocityLabel: {
    ...Typography.caption,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10.5,
    color: Colors.inkSoft,
    marginTop: 2,
    textAlign: 'center',
  },
  topHabitIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  topHabitTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13,
    color: Colors.marigoldDeep,
    textAlign: 'center',
  },

  // Slip Alert Card
  slipCard: {
    backgroundColor: 'rgba(193, 80, 46, 0.05)',
    borderColor: 'rgba(193, 80, 46, 0.22)',
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  slipContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  slipTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  slipEmoji: {
    fontSize: 18,
    marginTop: 1,
  },
  slipTextCol: {
    flex: 1,
  },
  slipTitle: {
    ...Typography.body,
    fontFamily: 'Fraunces_700Bold',
    fontSize: 13.5,
    color: Colors.clayDeep,
  },
  slipSub: {
    ...Typography.caption,
    fontFamily: 'Manrope_500Medium',
    fontSize: 11.5,
    color: Colors.clayDeep,
    marginTop: 2,
    lineHeight: 16,
  },
  catchUpBtn: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.clayDeep,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
  },
  catchUpBtnText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.white,
  },
});
