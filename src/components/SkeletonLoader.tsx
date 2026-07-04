import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Radius } from '@/constants/theme';

export function SkeletonBlock({ width, height, borderRadius = Radius.md, style }: { width: any; height: any; borderRadius?: number; style?: any }) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 800 }),
        withTiming(0.35, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function TaskCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <SkeletonBlock width={40} height={40} borderRadius={20} />
        <View style={styles.cardDetails}>
          <SkeletonBlock width={140} height={18} />
          <SkeletonBlock width={80} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonBlock width={36} height={36} borderRadius={18} />
    </View>
  );
}

export function StatsSkeleton() {
  return (
    <View style={styles.statsRow}>
      <SkeletonBlock width={90} height={46} borderRadius={Radius.lg} />
      <SkeletonBlock width={90} height={46} borderRadius={Radius.lg} />
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      <StatsSkeleton />
      <View style={{ marginTop: 24 }}>
        <SkeletonBlock width={100} height={18} style={{ marginBottom: 12 }} />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E6E7ED',
  },
  container: {
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.ivoryLine,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardDetails: {
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
});
