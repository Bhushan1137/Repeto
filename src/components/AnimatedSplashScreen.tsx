import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PARTICLES = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  startX: Math.random() * SCREEN_WIDTH,
  startY: SCREEN_HEIGHT * 0.45 + Math.random() * (SCREEN_HEIGHT * 0.4),
  delay: i * 140,
}));

function FloatingParticle({ startX, startY, delay }: { startX: number; startY: number; delay: number }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(Math.random() * 0.5 + 0.5);

  useEffect(() => {
    // Premium smooth floating motion
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-120 - Math.random() * 80, { duration: 5500 + Math.random() * 1500 }),
        -1,
        false
      )
    );

    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(Math.random() * 30 - 15, { duration: 2500 }),
          withTiming(Math.random() * 30 - 15, { duration: 2500 })
        ),
        -1,
        true
      )
    );

    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(Math.random() * 0.4 + 0.3, { duration: 1500 }),
          withTiming(Math.random() * 0.4 + 0.3, { duration: 2000 }),
          withTiming(0, { duration: 1500 })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: startX, top: startY },
        animatedStyle,
      ]}
    />
  );
}

export function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  
  // Ambient radial glow breathing animation
  const glowScale = useSharedValue(0.85);
  const glowOpacity = useSharedValue(0.12);

  // Moving gold shimmer translation value
  const shimmerTranslate = useSharedValue(-180);

  const textOpacity = useSharedValue(0);
  const subtextOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    // Hide standard native loader immediately
    SplashScreen.hideAsync().catch(() => { });

    // Logo scale-up and fade-in
    logoScale.value = withTiming(1.0, { duration: 1200 });
    logoOpacity.value = withTiming(1.0, { duration: 1000 });

    // Glow pulsing animation
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 3000 }),
        withTiming(0.85, { duration: 3000 })
      ),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.24, { duration: 3000 }),
        withTiming(0.12, { duration: 3000 })
      ),
      -1,
      true
    );

    // Loop the gold shimmer sweep across the logo
    shimmerTranslate.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(180, { duration: 1400 }),
          withTiming(-180, { duration: 0 }),
          withDelay(2200, withTiming(-180, { duration: 0 }))
        ),
        -1,
        false
      )
    );

    // Staggered text label reveal
    textOpacity.value = withDelay(800, withTiming(1.0, { duration: 900 }));
    subtextOpacity.value = withDelay(1400, withTiming(0.8, { duration: 900 }));

    // Seamless cinematic fade exit
    screenOpacity.value = withDelay(
      3200,
      withTiming(0, { duration: 700 }, (isFinished) => {
        if (isFinished) {
          runOnJS(onAnimationFinish)();
        }
      })
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shimmerTranslate.value },
      { rotate: '25deg' },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const subtextStyle = useAnimatedStyle(() => ({
    opacity: subtextOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={[Colors.indigo950, '#0C0E1E']}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle floating ambient particles */}
      {PARTICLES.map((p) => (
        <FloatingParticle key={p.id} startX={p.startX} startY={p.startY} delay={p.delay} />
      ))}

      <View style={styles.content}>
        {/* Ambient radial lighting glow behind logo */}
        <Animated.View style={[styles.glowCircle, glowStyle]}>
          <LinearGradient
            colors={['rgba(232, 163, 93, 0.45)', 'rgba(232, 163, 93, 0)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Center Logo with Shimmer Mask */}
        <View style={styles.logoWrapper}>
          <Animated.Image
            source={require('../../assets/images/splash-icon.png')}
            style={[styles.logo, logoStyle]}
            resizeMode="contain"
          />
          {/* Moving Gold Shimmer Layer */}
          <Animated.View style={[styles.shimmerContainer, shimmerStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255, 223, 140, 0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.brandText, textStyle]}>
          REPEATO
        </Animated.Text>
        <Animated.Text style={[styles.brandSubtext, subtextStyle]}>
          REPEAT. TOGETHER. EFFORTLESSLY.
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  glowCircle: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 26,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 26,
  },
  shimmerContainer: {
    position: 'absolute',
    width: 80,
    height: '200%',
    top: '-50%',
  },
  brandText: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 28,
    color: Colors.white,
    marginTop: 28,
    letterSpacing: 6,
  },
  brandSubtext: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 9.5,
    color: Colors.marigold,
    marginTop: 10,
    letterSpacing: 2.2,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.marigoldLight,
  },
});
