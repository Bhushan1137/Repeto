import { OnboardingProvider } from '@/context/OnboardingProvider';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="language" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="suggestions" />
        <Stack.Screen name="finish" />
      </Stack>
    </OnboardingProvider>
  );
}
