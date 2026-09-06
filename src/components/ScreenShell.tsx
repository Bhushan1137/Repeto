import { ActivityFeed } from '@/components/ActivityFeed';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Gradients, Layout, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTasks } from '@/providers/TaskProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { Card, Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenShellProps {
  title: string | React.ReactNode;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
  scrollRef?: React.RefObject<ScrollView | null>;
  contentStyle?: ViewStyle;
  lightHeader?: boolean;
  showBack?: boolean;
  onBackPress?: () => void;
}

export function ScreenShell({
  title,
  subtitle,
  headerExtra,
  children,
  scroll = true,
  scrollProps,
  scrollRef,
  contentStyle,
  lightHeader = false,
  showBack = false,
  onBackPress,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { unreadCount } = useNotifications();
  const [activityVisible, setActivityVisible] = useState(false);

  // ─── Header Metrics ────────────────────────────────────────────────────────
  const hasExtra = !!headerExtra;
  const COLLAPSE_DISTANCE = hasExtra ? 130 : 70;

  // ─── Scroll Animation Driver ────────────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;

  // ─── Animations for Compact Sticky Header Bar ──────────────────────────────
  // Translucent backdrop while scrolling, becomes solid once fully scrolled
  const compactBgOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE * 0.35, COLLAPSE_DISTANCE * 0.85, COLLAPSE_DISTANCE * 1.3],
    outputRange: [0, 0.35, 0.82, 0.96],
    extrapolate: 'clamp',
  });

  const compactShadowOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.4, COLLAPSE_DISTANCE * 1.2],
    outputRange: [0, 0.18],
    extrapolate: 'clamp',
  });

  // Hairline border appears faintly while scrolling, fully solid when scrolled
  const separatorOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE * 0.4, COLLAPSE_DISTANCE * 1.2],
    outputRange: [0, 0.35, 1],
    extrapolate: 'clamp',
  });

  // Logo stays crisp and prominent (no aggressive shrinking)
  const logoScale = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE],
    outputRange: [1, 0.96],
    extrapolate: 'clamp',
  });

  const logoTranslateX = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE],
    outputRange: [0, 0],
    extrapolate: 'clamp',
  });

  // Compact title stays translucent while scrolling, turns crisp 1.0 when fully scrolled
  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.25, COLLAPSE_DISTANCE * 0.75, COLLAPSE_DISTANCE * 1.2],
    outputRange: [0, 0.55, 1],
    extrapolate: 'clamp',
  });

  const compactTitleTranslateY = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.25, COLLAPSE_DISTANCE * 0.9],
    outputRange: [10, 0],
    extrapolate: 'clamp',
  });

  const compactTitleScale = scrollY.interpolate({
    inputRange: [COLLAPSE_DISTANCE * 0.25, COLLAPSE_DISTANCE * 0.9],
    outputRange: [0.95, 1],
    extrapolate: 'clamp',
  });

  const bellScale = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE],
    outputRange: [1, 0.94],
    extrapolate: 'clamp',
  });

  // ─── Animations for Expanded Content (Parallax & Translucency) ───────────────
  // Expanded header content stays partially visible (translucent) while scrolling down
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_DISTANCE * 0.5, COLLAPSE_DISTANCE * 1.1],
    outputRange: [1, 0.45, 0],
    extrapolate: 'clamp',
  });

  const expandedScale = scrollY.interpolate({
    inputRange: [-COLLAPSE_DISTANCE, 0, COLLAPSE_DISTANCE],
    outputRange: [1.08, 1, 0.92],
    extrapolate: 'clamp',
  });

  const expandedTranslateY = scrollY.interpolate({
    inputRange: [-COLLAPSE_DISTANCE, 0, COLLAPSE_DISTANCE],
    outputRange: [COLLAPSE_DISTANCE * 0.4, 0, -24],
    extrapolate: 'clamp',
  });

  // Background Parallax for pull-to-refresh / overscroll
  const bgScale = scrollY.interpolate({
    inputRange: [-COLLAPSE_DISTANCE * 2, 0],
    outputRange: [1.4, 1],
    extrapolate: 'clamp',
  });

  const bgTranslateY = scrollY.interpolate({
    inputRange: [-COLLAPSE_DISTANCE * 2, 0],
    outputRange: [-COLLAPSE_DISTANCE * 0.8, 0],
    extrapolate: 'clamp',
  });

  const accentGlowTranslateY = scrollY.interpolate({
    inputRange: [-100, 0, COLLAPSE_DISTANCE * 2],
    outputRange: [-30, 0, 40],
    extrapolate: 'clamp',
  });

  const compactTitleText =
    typeof title === 'string'
      ? (title.includes(',') ? title.split(',').slice(1).join(',').trim() : title)
      : undefined;

  // ─── Expanded Header Component ───────────────────────────────────────────────
  const expandedHeaderInner = lightHeader ? null : (
    <Animated.View style={{ transform: [{ scale: bgScale }, { translateY: bgTranslateY }] }}>
      <LinearGradient
        colors={[...Gradients.hero]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.header,
          {
            paddingTop: insets.top + 64, // Extra breathing room below sticky bar
            paddingBottom: Layout.contentOverlap + 16,
          },
        ]}
      >
        {/* Subtle accent gradient overlay */}
        <LinearGradient
          colors={[...Gradients.heroAccent]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Ambient Glowing Accent Orb */}
        <Animated.View
          style={[
            styles.headerGlowOrb,
            {
              transform: [{ translateY: accentGlowTranslateY }],
              opacity: expandedOpacity,
            },
          ]}
          pointerEvents="none"
        />

        <View style={styles.headerInner}>
          {/* Expanded Title */}
          <Animated.View
            style={{
              opacity: expandedOpacity,
              transform: [{ translateY: expandedTranslateY }, { scale: expandedScale }],
            }}
          >
            {typeof title === 'string' ? (
              <Text style={styles.title}>{title}</Text>
            ) : (
              title
            )}
          </Animated.View>

          {/* Subtitle */}
          {subtitle ? (
            <Animated.View
              style={{
                opacity: expandedOpacity,
                transform: [{ translateY: expandedTranslateY }, { scale: expandedScale }],
              }}
            >
              <Text style={styles.sub}>{subtitle}</Text>
            </Animated.View>
          ) : null}

          {/* Header Extra */}
          {headerExtra ? (
            <Animated.View
              style={{
                opacity: expandedOpacity,
                transform: [{ translateY: expandedTranslateY }, { scale: expandedScale }],
              }}
            >
              {headerExtra}
            </Animated.View>
          ) : null}
        </View>
      </LinearGradient>
    </Animated.View>
  );

  // ─── Compact Sticky Header (Overlays ScrollView at zIndex 100) ──────────────
  const compactStickyHeader = lightHeader ? null : (
    <Animated.View
      style={[
        styles.compactStickyHeader,
        {
          paddingTop: insets.top + 8,
          height: insets.top + 62,
          shadowOpacity: compactShadowOpacity,
        },
      ]}
    >
      {/* Sticky solid background gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: compactBgOpacity }]}>
        <LinearGradient
          colors={[...Gradients.hero]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <LinearGradient
            colors={['rgba(232,163,61,0.20)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </LinearGradient>
      </Animated.View>

      {/* Brand row elements */}
      <View style={styles.brandRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {showBack && (
            <Pressable
              onPress={() => {
                if (onBackPress) {
                  onBackPress();
                } else if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }}
              style={styles.backButton}
              hitSlop={8}
            >
              <AppIcon name="chevron-back" size={24} color={Colors.white} />
            </Pressable>
          )}
          <Animated.Image
            source={require('../../assets/images/logo.png')}
            style={[
              styles.brandLogo,
              {
                transform: [
                  { scale: logoScale },
                  { translateX: logoTranslateX },
                ],
              },
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Compact Title (Pill Badge for refined visual balance) */}
        {compactTitleText ? (
          <Animated.View
            style={[
              styles.compactTitleWrapper,
              {
                opacity: compactTitleOpacity,
                transform: [
                  { translateY: compactTitleTranslateY },
                  { scale: compactTitleScale },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.compactTitleBadge}>
              <Text style={styles.compactTitle} numberOfLines={1}>
                {compactTitleText}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Bell notification button */}
        <Animated.View style={{ transform: [{ scale: bellScale }] }}>
          <Pressable
            style={styles.bellPressable}
            onPress={() => router.push('/notifications')}
            hitSlop={8}
          >
            <AppIcon name="notifications-outline" size={21} color={Colors.white} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </View>

      {/* Hairline glowing border at bottom of collapsed header */}
      <Animated.View
        style={[styles.headerSeparator, { opacity: separatorOpacity }]}
        pointerEvents="none"
      />
    </Animated.View>
  );

  const body = (
    <View
      style={[
        styles.content,
        !lightHeader && { marginTop: -Layout.contentOverlap },
        lightHeader && styles.contentFlat,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  // Merge external onScroll listener with animation driver using useNativeDriver: true
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: scrollProps?.onScroll as any,
    }
  );

  const { onScroll: _externalOnScroll, ...restScrollProps } = scrollProps ?? {};

  return (
    <View style={styles.root}>
      {scroll ? (
        <Animated.ScrollView
          ref={scrollRef as any}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          {...restScrollProps}
          onScroll={onScroll}
        >
          {expandedHeaderInner}
          {body}
        </Animated.ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {expandedHeaderInner}
          {body}
        </View>
      )}

      {/* Compact sticky header overlays ScrollView at zIndex 100 */}
      {compactStickyHeader}

      {/* Recent Activity Modal */}
      <Modal
        visible={activityVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActivityVisible(false)}
      >
        <Pressable style={styles.activityBackdrop} onPress={() => setActivityVisible(false)} />
        <Card style={styles.activitySheet} mode="elevated">
          <Card.Content style={styles.activityContent}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>
                {user?.language === 'hi' ? 'हालिया गतिविधि' : 'Recent Activity'}
              </Text>
              <Pressable onPress={() => setActivityVisible(false)} hitSlop={12} style={styles.activityCloseBtn}>
                <AppIcon name="close" size={20} color={Colors.ink} />
              </Pressable>
            </View>
            <Animated.ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <ActivityFeed
                tasks={tasks}
                members={user?.householdMembers ?? []}
                currentUserId={user?.id}
                currentUserName={user?.name ?? 'You'}
                language={user?.language ?? 'en'}
              />
            </Animated.ScrollView>
          </Card.Content>
        </Card>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function SectionHeader({
  label,
  count,
  accent,
}: {
  label: string;
  count?: number;
  accent?: 'default' | 'danger';
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, accent === 'danger' && styles.sectionDanger]}>{label}</Text>
      {count !== undefined ? (
        <Surface style={[styles.countBadge, accent === 'danger' && styles.countBadgeDanger]} elevation={0}>
          <Text style={[styles.countText, accent === 'danger' && styles.countTextDanger]}>{count}</Text>
        </Surface>
      ) : null}
    </View>
  );
}

export function StatPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <Card style={[styles.statPill, tone === 'warn' && styles.statPillWarn]} mode="outlined">
      <Card.Content style={styles.statContent}>
        <Text style={[styles.statValue, tone === 'warn' && styles.statValueWarn]}>{value}</Text>
        <Text style={[styles.statLabel, tone === 'warn' && styles.statLabelWarn]}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={styles.emptyCard} mode="elevated">
      <Card.Content style={styles.emptyContent}>
        <Surface style={styles.emptyIconWrap} elevation={1}>
          <Text style={styles.emptyIcon}>{icon}</Text>
        </Surface>
        <Text style={styles.emptyTitle}>{title}</Text>
        {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
        {action}
      </Card.Content>
    </Card>
  );
}

// ─── Enhanced Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceMuted },

  // ── Compact sticky header container ──
  compactStickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPadding,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },

  // ── Gradient header (non-light) ──
  header: {
    paddingHorizontal: Layout.screenPadding,
    overflow: 'hidden',
    position: 'relative',
  },
  headerGlowOrb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(232, 163, 61, 0.14)',
  },
  headerInner: {},
  headerSeparator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(232, 163, 61, 0.35)',
  },

  // ── Light header ──
  headerLight: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 8,
    backgroundColor: Colors.surfaceMuted,
  },

  // ── Brand bar ──
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  brandLogo: {
    width: 122,
    height: 42,
  },
  compactTitleWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  compactTitleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    maxWidth: 160,
  },
  compactTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.onDark,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  bellPressable: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251,247,239,0.2)',
    backgroundColor: 'rgba(251,247,239,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.marigold,
    borderRadius: Radius.xs,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 8.5,
    color: Colors.white,
  },

  // ── Text layers ──
  title: {
    ...Typography.displayMd,
    color: Colors.onDark,
    marginBottom: 2,
  },
  sub: {
    ...Typography.bodySm,
    color: Colors.onDarkMuted,
    maxWidth: 320,
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 20,
  },
  titleLight: { ...Typography.displayMd, color: Colors.ink, marginBottom: 4 },
  subLight: { ...Typography.bodySm, color: Colors.inkSoft, marginBottom: 8 },

  // ── Scroll / content ──
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  content: {
    backgroundColor: Colors.surfaceMuted,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Layout.screenPadding,
    paddingTop: Layout.screenPadding,
    minHeight: 200,
  },
  contentFlat: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },

  // ── Section header ──
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 12 },
  sectionLabel: { ...Typography.label, color: Colors.inkFaint, flex: 1 },
  sectionDanger: { color: Colors.clayDeep },
  countBadge: {
    backgroundColor: Colors.ivoryDim,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  countBadgeDanger: { backgroundColor: 'rgba(193,80,46,0.12)' },
  countText: { ...Typography.caption, color: Colors.inkSoft, fontSize: 10 },
  countTextDanger: { color: Colors.clayDeep },

  // ── Stat pill ──
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(251,247,239,0.22)',
    borderRadius: Radius.md,
  },
  statPillWarn: {
    backgroundColor: 'rgba(193,80,46,0.15)',
    borderColor: 'rgba(193,80,46,0.3)',
  },
  statContent: { paddingVertical: 8, paddingHorizontal: 12 },
  statValue: { fontFamily: 'Fraunces_700Bold', fontSize: 22, color: Colors.onDark, marginBottom: 2 },
  statValueWarn: { color: '#FFB89A' },
  statLabel: { ...Typography.caption, color: Colors.onDarkMuted, fontSize: 10.5 },
  statLabelWarn: { color: 'rgba(255,255,255,0.7)' },

  // ── Empty state ──
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginVertical: 16,
    elevation: 1,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { ...Typography.displaySm, color: Colors.ink, marginBottom: 8, textAlign: 'center' },
  emptySub: {
    ...Typography.bodySm,
    color: Colors.inkSoft,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    maxWidth: 280,
  },

  // ── Activity modal ──
  activityBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  activitySheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  activityContent: { flex: 1, padding: 20 },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
    paddingBottom: 12,
  },
  activityTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.indigo950,
  },
  activityCloseBtn: { padding: 4 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
});
