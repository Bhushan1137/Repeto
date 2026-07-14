import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Text, Card, TouchableRipple } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { ScreenShell } from '@/components/ScreenShell';
import { Button } from '@/components/Button';
import { Colors, Radius, Typography } from '@/constants/theme';
import { initials } from '@/domain/insights';

export default function NotificationsScreen() {
  const router = useRouter();
  const { translate, language } = useTranslation();
  const { notifications, unreadCount, markAllAsRead, deleteNotification } = useNotifications();

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
        return { icon: 'people-outline', color: Colors.marigoldDeep, bg: 'rgba(232,163,61,0.08)' };
      case 'payment':
        return { icon: 'trash-outline', color: Colors.clayDeep, bg: 'rgba(193,80,46,0.08)' }; // Wallet / Expense placeholder
      case 'streak':
        return { icon: 'star-outline', color: Colors.tealDeep, bg: 'rgba(62,124,106,0.08)' };
      default:
        return { icon: 'notifications-outline', color: Colors.indigo950, bg: Colors.ivoryDim };
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableRipple
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          style={styles.backBtn}
          borderless
        >
          <AppIcon name="chevron-back" size={22} color={Colors.indigo950} />
        </TouchableRipple>
        <Text style={styles.headerTitle}>{language === 'hi' ? 'सूचनाएं' : 'Notifications'}</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={{ fontSize: 32 }}>🔔</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {language === 'hi' ? 'आप बिल्कुल अपडेट हैं' : "You're all caught up!"}
            </Text>
            <Text style={styles.emptySub}>
              {language === 'hi' ? 'अभी कोई नई सूचना उपलब्ध नहीं है।' : 'No new updates or alerts at the moment.'}
            </Text>
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
            />
          </View>
        ) : (
          notifications.map((item) => {
            const styleOpts = getNotifIconAndColor(item.type);
            return (
              <Card key={item.id} style={[styles.notifCard, !item.read && styles.unreadCard]} mode="elevated">
                <Card.Content style={styles.cardContent}>
                  <View style={[styles.iconCircle, { backgroundColor: styleOpts.bg }]}>
                    <AppIcon name={styleOpts.icon} size={20} color={styleOpts.color} />
                  </View>
                  <View style={styles.textCol}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody}>{item.body}</Text>
                    <Text style={styles.timeText}>{formatRelativeTime(item.timestamp)}</Text>
                  </View>
                  <TouchableRipple
                    onPress={() => deleteNotification(item.id)}
                    style={styles.deleteBtn}
                    borderless
                  >
                    <AppIcon name="close" size={16} color={Colors.inkFaint} />
                  </TouchableRipple>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ivoryLine,
  },
  backBtn: {
    padding: 6,
    borderRadius: Radius.full,
    marginRight: 10,
  },
  headerTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 20,
    color: Colors.indigo950,
  },
  badge: {
    backgroundColor: Colors.marigold,
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontFamily: 'Manrope_800ExtraBold',
    color: Colors.white,
    fontSize: 10,
  },
  container: {
    padding: 16,
    flexGrow: 1,
  },
  notifCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginBottom: 10,
    elevation: 1,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.marigold,
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
    fontSize: 13.5,
    color: Colors.ink,
    lineHeight: 18,
  },
  notifBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 4,
    lineHeight: 16,
  },
  timeText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 10,
    color: Colors.inkFaint,
    marginTop: 6,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: Radius.full,
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 18,
    color: Colors.indigo950,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: 6,
    marginHorizontal: 32,
    lineHeight: 18,
  },
  goBackBtn: {
    marginTop: 24,
    minWidth: 150,
  },
});
