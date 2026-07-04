import { Redirect } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { Colors } from '@/constants/theme';
import { DashboardSkeleton } from '@/components/SkeletonLoader';

export default function Index() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <View style={styles.center}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!user) return <Redirect href="/(onboarding)/language" />;
  if (!user.profileComplete) return <Redirect href="/(onboarding)/profile" />;
  if (!user.onboardingComplete) return <Redirect href="/(onboarding)/categories" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: Colors.surfaceMuted, paddingTop: 50 },
});
