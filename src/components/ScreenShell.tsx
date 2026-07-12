import { ActivityFeed } from '@/components/ActivityFeed';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Gradients, Layout, Radius, Typography } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTasks } from '@/providers/TaskProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
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
  contentStyle?: ViewStyle;
  lightHeader?: boolean;
}

export function ScreenShell({
  title,
  subtitle,
  headerExtra,
  children,
  scroll = true,
  scrollProps,
  contentStyle,
  lightHeader = false,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { unreadCount } = useNotifications();
  const [activityVisible, setActivityVisible] = useState(false);

  const header = lightHeader ? (
    <View style={[styles.headerLight, { paddingTop: insets.top + 16 }]}>
      {typeof title === 'string' ? (
        <Text style={styles.titleLight}>{title}</Text>
      ) : (
        title
      )}
      {subtitle ? <Text style={styles.subLight}>{subtitle}</Text> : null}
      {headerExtra}
    </View>
  ) : (
    <LinearGradient
      colors={[...Gradients.hero]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 16 }]}
    >
      <LinearGradient
        colors={[...Gradients.heroAccent]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.headerInner}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Pressable
            style={styles.bellPressable}
            onPress={() => router.push('/notifications')}
            hitSlop={8}
          >
            <AppIcon name="notifications-outline" size={22} color={Colors.white} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        {typeof title === 'string' ? (
          <Text style={styles.title}>{title}</Text>
        ) : (
          title
        )}
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        {headerExtra}
      </View>
    </LinearGradient>
  );

  const body = (
    <View style={[styles.content, lightHeader && styles.contentFlat, contentStyle]}>
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      {header}
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}

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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <ActivityFeed
                tasks={tasks}
                members={user?.householdMembers ?? []}
                currentUserId={user?.id}
                currentUserName={user?.name ?? 'You'}
                language={user?.language ?? 'en'}
              />
            </ScrollView>
          </Card.Content>
        </Card>
      </Modal>
    </View>
  );
}

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

export function StatPill({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warn' }) {
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceMuted },
  header: {
    paddingBottom: Layout.contentOverlap + 6,
    paddingHorizontal: Layout.screenPadding,
    overflow: 'hidden',
  },
  headerLight: {
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: 8,
    backgroundColor: Colors.surfaceMuted,
  },
  headerInner: { position: 'relative' },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  brandLogo: { width: 140, height: 50, padding: 0, margin: 0 },
  bellPressable: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251,247,239,0.18)',
    backgroundColor: 'rgba(251,247,239,0.06)',
    margin: 0,
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
  title: { ...Typography.displayMd, color: Colors.onDark, marginBottom: 4 },
  sub: { ...Typography.bodySm, color: Colors.onDarkMuted, maxWidth: 300 },
  titleLight: { ...Typography.displayMd, color: Colors.ink, marginBottom: 4 },
  subLight: { ...Typography.bodySm, color: Colors.inkSoft, marginBottom: 8 },
  scroll: { flex: 1, marginTop: -Layout.contentOverlap },
  scrollContent: { paddingBottom: 110 },
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
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(251,247,239,0.22)',
    borderRadius: Radius.md,
  },
  statPillWarn: {
    backgroundColor: 'rgba(193,80,46,0.15)',
    borderColor: 'rgba(193,80,46,0.3)',
  },
  statContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statValue: { fontFamily: 'Fraunces_700Bold', fontSize: 22, color: Colors.onDark, marginBottom: 2 },
  statValueWarn: { color: '#FFB89A' },
  statLabel: { ...Typography.caption, color: Colors.onDarkMuted, fontSize: 10.5 },
  statLabelWarn: { color: 'rgba(255, 255, 255, 0.7)' },
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
  emptySub: { ...Typography.bodySm, color: Colors.inkSoft, textAlign: 'center', lineHeight: 21, marginBottom: 20, maxWidth: 280 },
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
  activityContent: {
    flex: 1,
    padding: 20,
  },
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
  activityCloseBtn: {
    padding: 4,
  },
});

