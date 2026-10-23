import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Linking } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTasks } from '@/providers/TaskProvider';
import { useRecommendations } from '@/providers/RecommendationProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { ScreenShell, EmptyState } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { Colors, Radius } from '@/constants/theme';
import type { AppNotification } from '@/types/notification';

interface NotificationItemProps {
  item: AppNotification;
  index: number;
  clearing: boolean;
  onDelete: (id: string) => void;
  onPress?: (item: AppNotification) => void;
  language: string;
  formatRelativeTime: (iso: string) => string;
  getNotifIconAndColor: (type: string) => { icon: AppIconName; color: string; bg: string };
}

function NotificationItem({
  item,
  index,
  clearing,
  onDelete,
  onPress,
  language,
  formatRelativeTime,
  getNotifIconAndColor,
}: NotificationItemProps) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (clearing) {
      const screenWidth = Dimensions.get('window').width;
      const delay = Math.min(index * 40, 400);
      translateX.value = withDelay(
        delay,
        withTiming(screenWidth + 60, {
          duration: 250,
          easing: Easing.out(Easing.quad),
        })
      );
      opacity.value = withDelay(
        delay,
        withTiming(0, {
          duration: 210,
          easing: Easing.out(Easing.quad),
        })
      );
    }
  }, [clearing, index, translateX, opacity]);

  const handleDismissSingle = useCallback(() => {
    if (isDismissing || clearing) return;
    setIsDismissing(true);
    const screenWidth = Dimensions.get('window').width;
    translateX.value = withTiming(
      screenWidth + 60,
      {
        duration: 220,
        easing: Easing.out(Easing.quad),
      },
      (finished) => {
        if (finished) {
          runOnJS(onDelete)(item.id);
        }
      }
    );
    opacity.value = withTiming(0, { duration: 180 });
  }, [isDismissing, clearing, item.id, onDelete, translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const styleOpts = getNotifIconAndColor(item.type);

  return (
    <Animated.View style={animatedStyle}>
      <Card
        style={[
          styles.notifCard,
          !item.read && styles.unreadCard,
          item.type === 'campaign' && styles.campaignCard,
        ]}
        mode="elevated"
        onPress={onPress ? () => onPress(item) : undefined}
        testID={`notification-card-${item.id}`}
      >
        {/* Unread Accent Indicator Bar (smoothly clipped, no corner border artifacts) */}
        {!item.read && <View style={styles.unreadIndicatorBar} />}

        <Card.Content style={styles.cardContent} testID={`notification-card-content-${item.id}`}>
          <View style={[styles.iconCircle, { backgroundColor: styleOpts.bg }]} testID={`notification-icon-wrap-${item.id}`}>
            <AppIcon name={styleOpts.icon} size={20} color={styleOpts.color} />
          </View>
          <View style={styles.textCol} testID={`notification-text-col-${item.id}`}>
            {item.type === 'campaign' && (
              <View style={styles.campaignBadge}>
                <Text style={styles.campaignBadgeText}>
                  {language === 'hi' ? 'विशेष ऑफर' : 'SPECIAL OFFER'}
                </Text>
              </View>
            )}
            <View style={styles.titleRow}>
              <Text style={styles.notifTitle} testID={`notification-title-${item.id}`}>{item.title}</Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notifBody} testID={`notification-body-${item.id}`}>{item.body}</Text>
            {item.type === 'campaign' && item.metadata?.promoCode ? (
              <View style={styles.promoCodeChip}>
                <AppIcon name="pricetag-outline" size={12} color={Colors.clay} />
                <Text style={styles.promoCodeChipText}>
                  {language === 'hi' ? `कोड: ${item.metadata.promoCode}` : `CODE: ${item.metadata.promoCode}`}
                </Text>
              </View>
            ) : null}
            {item.type === 'campaign' && item.metadata?.redirectUrl ? (
              <View style={styles.promoActionRow}>
                <Text style={styles.promoActionText}>
                  {item.metadata.buttonText || (language === 'hi' ? 'ऑफर देखें' : 'View Offer')}
                </Text>
                <AppIcon name="chevron-forward" size={12} color={Colors.clayDeep} />
              </View>
            ) : null}
            <Text style={styles.timeText} testID={`notification-time-${item.id}`}>{formatRelativeTime(item.timestamp)}</Text>
          </View>
          <TouchableRipple
            onPress={handleDismissSingle}
            style={styles.deleteBtn}
            testID={`notification-delete-btn-${item.id}`}
            borderless
          >
            <AppIcon name="close" size={16} color={Colors.inkFaint} />
          </TouchableRipple>
        </Card.Content>
      </Card>
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const { notifications, markAllAsRead, deleteNotification, clearAllNotifications } = useNotifications();
  const { setFocusTaskId } = useTasks();
  const { logClick } = useRecommendations();
  const [clearing, setClearing] = useState(false);

  React.useEffect(() => {
    // Automatically mark all notifications as read when entering the inbox
    markAllAsRead();
  }, [markAllAsRead]);

  const handleNotificationPress = useCallback(
    (item: AppNotification) => {
      if (item.type === 'campaign') {
        if (item.metadata?.campaignId) {
          logClick(item.metadata.campaignId).catch(() => {});
        }
        if (item.metadata?.redirectUrl) {
          Linking.openURL(item.metadata.redirectUrl).catch(() => {});
        }
        return;
      }

      if (item.metadata?.taskId) {
        setFocusTaskId(item.metadata.taskId);
        router.replace('/(tabs)');
      }
    },
    [setFocusTaskId, router, logClick]
  );

  const formatRelativeTime = (isoString: string) => {
    const elapsed = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return language === 'hi' ? 'अभी-अभी' : 'Just now';
    if (minutes < 60) return language === 'hi' ? `${minutes} मिनट पहले` : `${minutes}m ago`;
    if (hours < 24) return language === 'hi' ? `${hours} घंटे पहले` : `${hours}h ago`;
    return language === 'hi' ? `${days} दिन पहले` : `${days}d ago`;
  };

  const getNotifIconAndColor = (type: string): { icon: AppIconName; color: string; bg: string } => {
    switch (type) {
      case 'campaign':
        return { icon: 'pricetag-outline', color: Colors.clay, bg: 'rgba(193, 80, 46, 0.10)' };
      case 'household':
        return { icon: 'people-outline', color: '#0D9488', bg: 'rgba(13, 148, 136, 0.08)' };
      case 'payment':
      case 'finance':
        return { icon: 'documents-outline', color: Colors.clayDeep, bg: 'rgba(193, 80, 46, 0.08)' };
      case 'streak':
        return { icon: 'star-outline', color: Colors.marigoldDeep, bg: 'rgba(232, 163, 61, 0.08)' };
      default:
        return { icon: 'notifications-outline', color: Colors.indigo950, bg: 'rgba(23, 27, 54, 0.08)' };
    }
  };

  const handleClearAll = useCallback(() => {
    if (clearing || notifications.length === 0) return;
    setClearing(true);

    const animationDuration = 260 + Math.min((notifications.length - 1) * 40, 400);
    setTimeout(async () => {
      await clearAllNotifications();
      setClearing(false);
    }, animationDuration);
  }, [clearing, notifications.length, clearAllNotifications]);

  return (
    <ScreenShell
      title={language === 'hi' ? 'सूचनाएं' : 'Notifications'}
      subtitle={language === 'hi' ? 'आपकी हालिया सूचनाएं और अपडेट' : 'Your recent updates and alerts'}
      showBack={true}
      hideNotificationBell={true}
      onBackPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }}
    >
      {notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={language === 'hi' ? 'आप बिल्कुल अपडेट हैं' : "You're all caught up!"}
          subtitle={language === 'hi' ? 'अभी कोई नई सूचना उपलब्ध नहीं है।' : 'No new updates or alerts at the moment.'}
          action={
            <Button
              title={language === 'hi' ? 'वापस जाएं' : 'Go Back'}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }}
              style={styles.goBackBtn}
              testID="notifications-empty-back-btn"
            />
          }
        />
      ) : (
        <View style={styles.listContainer} testID="notifications-list">
          {/* Top Actions Row */}
          <View style={styles.topActionsRow}>
            <Text style={styles.notifCountText}>
              {language === 'hi' ? `${notifications.length} अपडेट` : `${notifications.length} Updates`}
            </Text>
            <TouchableOpacity
              onPress={handleClearAll}
              disabled={clearing}
              style={[styles.clearAllBtn, clearing && { opacity: 0.5 }]}
              activeOpacity={0.7}
              testID="notifications-clear-all-btn"
            >
              <AppIcon name="trash-outline" size={14} color={Colors.clayDeep} />
              <Text style={styles.clearAllText}>
                {language === 'hi' ? 'सभी हटाएं' : 'Clear all'}
              </Text>
            </TouchableOpacity>
          </View>

          {notifications.map((item, index) => (
            <NotificationItem
              key={item.id}
              item={item}
              index={index}
              clearing={clearing}
              onDelete={deleteNotification}
              onPress={handleNotificationPress}
              language={language}
              formatRelativeTime={formatRelativeTime}
              getNotifIconAndColor={getNotifIconAndColor}
            />
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: 8,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  notifCountText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12.5,
    color: Colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(193, 80, 46, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
  },
  clearAllText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.clayDeep,
  },
  notifCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 12,
    elevation: 2,
    shadowColor: Colors.indigo950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  campaignCard: {
    borderColor: 'rgba(232, 163, 61, 0.35)',
    borderWidth: 1,
    backgroundColor: '#FFFCF7',
  },
  campaignBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginBottom: 5,
  },
  campaignBadgeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 9.5,
    color: Colors.clay,
    letterSpacing: 0.6,
  },
  promoCodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(193, 80, 46, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(193, 80, 46, 0.25)',
    borderStyle: 'dashed',
  },
  promoCodeChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: Colors.clay,
  },
  promoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 7,
  },
  promoActionText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: Colors.clayDeep,
  },
  unreadCard: {
    backgroundColor: '#FFFDF9',
  },
  unreadIndicatorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Colors.marigold,
    zIndex: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.marigold,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  notifTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: Colors.ink,
    lineHeight: 18,
  },
  notifBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12.5,
    color: Colors.inkSoft,
    marginTop: 4,
    lineHeight: 17,
  },
  timeText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10.5,
    color: Colors.inkFaint,
    marginTop: 6,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: Radius.full,
    alignSelf: 'center',
  },
  goBackBtn: {
    marginTop: 8,
    minWidth: 150,
  },
});
