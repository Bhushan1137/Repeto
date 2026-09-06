import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { ScreenShell, EmptyState } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { Colors, Radius } from '@/constants/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const { notifications, markAllAsRead, deleteNotification } = useNotifications();

  React.useEffect(() => {
    // Automatically mark all notifications as read when entering the inbox
    markAllAsRead();
  }, [markAllAsRead]);

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

  return (
    <ScreenShell
      title={language === 'hi' ? 'सूचनाएं' : 'Notifications'}
      subtitle={language === 'hi' ? 'आपकी हालिया सूचनाएं और अपडेट' : 'Your recent updates and alerts'}
      showBack={true}
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
          {notifications.map((item) => {
            const styleOpts = getNotifIconAndColor(item.type);
            return (
              <Card
                key={item.id}
                style={[styles.notifCard, !item.read && styles.unreadCard]}
                mode="elevated"
                testID={`notification-card-${item.id}`}
              >
                <Card.Content style={styles.cardContent} testID={`notification-card-content-${item.id}`}>
                  <View style={[styles.iconCircle, { backgroundColor: styleOpts.bg }]} testID={`notification-icon-wrap-${item.id}`}>
                    <AppIcon name={styleOpts.icon} size={20} color={styleOpts.color} />
                  </View>
                  <View style={styles.textCol} testID={`notification-text-col-${item.id}`}>
                    <Text style={styles.notifTitle} testID={`notification-title-${item.id}`}>{item.title}</Text>
                    <Text style={styles.notifBody} testID={`notification-body-${item.id}`}>{item.body}</Text>
                    <Text style={styles.timeText} testID={`notification-time-${item.id}`}>{formatRelativeTime(item.timestamp)}</Text>
                  </View>
                  <TouchableRipple
                    onPress={() => deleteNotification(item.id)}
                    style={styles.deleteBtn}
                    testID={`notification-delete-btn-${item.id}`}
                    borderless
                  >
                    <AppIcon name="close" size={16} color={Colors.inkFaint} />
                  </TouchableRipple>
                </Card.Content>
              </Card>
            );
          })}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: 8,
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
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.marigold,
    backgroundColor: '#FFFDF9',
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
