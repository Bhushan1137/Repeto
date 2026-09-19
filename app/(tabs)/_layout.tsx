import React, { useState } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { View, StyleSheet, Platform, Pressable, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { Colors, Gradients, Radius, Shadows, Typography, Layout } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/providers/ToastProvider';
import { Toast } from '@/components/Toast';
import { AddTaskSheet } from '@/components/AddTaskSheet';

type TabKey = 'index' | 'household' | 'insights' | 'profile';

const TAB_ICONS: Record<TabKey, { active: AppIconName; idle: AppIconName }> = {
  index: { active: 'home', idle: 'home-outline' },
  household: { active: 'people', idle: 'people-outline' },
  insights: { active: 'stats-chart', idle: 'stats-chart-outline' },
  profile: { active: 'person-circle', idle: 'person-circle-outline' },
};

function TabIcon({ tab, focused }: { tab: TabKey; focused: boolean }) {
  const icons = TAB_ICONS[tab];
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <AppIcon
        name={focused ? icons.active : icons.idle}
        size={22}
        color={focused ? Colors.marigoldDeep : Colors.inkFaint}
      />
    </View>
  );
}

function AddTabButton({ onOpen, ..._props }: PressableProps & { onOpen: () => void; children?: React.ReactNode }) {
  return (
    <Pressable onPress={onOpen} style={styles.addSlot} testID="add-task-fab">
      <View style={styles.fabOuter} testID="add-task-fab-outer">
        <LinearGradient colors={[...Gradients.marigold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <AppIcon name="add" size={30} color={Colors.indigo950} />
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { translate } = useTranslation();
  const { message } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const bottomPad = Math.max(insets.bottom, 12);

  const pathname = usePathname();
  const isHouseholdTab = !!(pathname && pathname.includes('household'));

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: bottomPad,
            height: Layout.tabBarHeight,
            paddingBottom: 8,
            paddingTop: 10,
            backgroundColor: Colors.white,
            borderTopWidth: 0,
            borderRadius: Radius.xl,
            borderWidth: 1,
            borderColor: 'rgba(228,219,199,0.5)',
            ...Shadows.tabBar,
          },
          tabBarActiveTintColor: Colors.marigoldDeep,
          tabBarInactiveTintColor: Colors.inkSoft,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: translate('navHome'),
            tabBarIcon: ({ focused }) => <TabIcon tab="index" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="household"
          options={{
            title: translate('navHH'),
            tabBarIcon: ({ focused }) => <TabIcon tab="household" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarButton: (props) => <AddTabButton {...props} onOpen={() => setShowAdd(true)} />,
            tabBarLabel: () => null,
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: translate('navInsights'),
            tabBarIcon: ({ focused }) => <TabIcon tab="insights" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: translate('navProfile'),
            tabBarIcon: ({ focused }) => <TabIcon tab="profile" focused={focused} />,
          }}
        />
      </Tabs>

      {/* Modal sheet opened by FAB — no navigation, no reload */}
      <AddTaskSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        defaultToHousehold={isHouseholdTab}
      />

      <Toast message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceMuted },
  tabItem: { paddingTop: 2 },
  tabLabel: {
    ...Typography.caption,
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    marginTop: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  iconWrapActive: { backgroundColor: 'rgba(201,127,30,0.12)' },
  addSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  fabOuter: {
    position: 'absolute',
    top: -32,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'transparent',
    ...Shadows.fab,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
