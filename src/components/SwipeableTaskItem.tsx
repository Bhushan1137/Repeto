import React, { useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, StyleProp, ViewStyle, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import ReanimatedSwipeable, {
  SwipeableMethods,
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
  SharedValue,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, Radius, Typography } from '@/constants/theme';
import { AppIcon } from '@/components/AppIcon';
import type { Language } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface SwipeableTaskItemProps {
  children: React.ReactNode;
  language: Language;
  onComplete?: () => void;
  onSnooze?: (days?: number) => void;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function LeftActionContent({
  translation,
  language,
}: {
  translation: SharedValue<number>;
  language: Language;
}) {
  const animatedContainerStyle = useAnimatedStyle(() => {
    const isRightSwipe = translation.value > 0;
    return {
      opacity: isRightSwipe ? 1 : 0,
      pointerEvents: (isRightSwipe ? 'auto' : 'none') as 'auto' | 'none',
    };
  });

  const animatedBadgeStyle = useAnimatedStyle(() => {
    if (translation.value <= 0) {
      return {
        opacity: 0,
        transform: [{ scale: 0.85 }],
      };
    }
    const opacity = interpolate(
      translation.value,
      [0, 25, 75],
      [0.2, 0.7, 1],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      translation.value,
      [0, 50, 110, 180],
      [0.85, 0.95, 1.08, 1.12],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View style={[styles.leftActionContainer, animatedContainerStyle]}>
      <View style={styles.actionCardDone}>
        <Animated.View style={[styles.doneContentRow, animatedBadgeStyle]}>
          <View style={styles.iconCircleDone}>
            <AppIcon name="checkmark" size={18} color={Colors.white} />
          </View>
          <View style={styles.doneTextCol}>
            <Text style={styles.doneTitle}>
              {language === 'hi' ? 'पूरा करें' : 'Done'}
            </Text>
            <Text style={styles.doneSub}>
              {language === 'hi' ? 'संपन्न करने के लिए स्वाइप करें' : 'Release to complete'}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function RightActionContent({
  translation,
  language,
  onPressSnooze,
}: {
  translation: SharedValue<number>;
  language: Language;
  onPressSnooze: () => void;
}) {
  const animatedContainerStyle = useAnimatedStyle(() => {
    const isLeftSwipe = translation.value < 0;
    return {
      opacity: isLeftSwipe ? 1 : 0,
      pointerEvents: (isLeftSwipe ? 'auto' : 'none') as 'auto' | 'none',
    };
  });

  const animatedBadgeStyle = useAnimatedStyle(() => {
    if (translation.value >= 0) {
      return {
        opacity: 0,
        transform: [{ scale: 0.75 }],
      };
    }
    const drag = -translation.value;
    const scale = interpolate(drag, [0, 40, 92], [0.75, 0.9, 1], Extrapolation.CLAMP);
    const opacity = interpolate(drag, [0, 25, 75], [0.3, 0.7, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View style={[styles.rightActionContainer, animatedContainerStyle]}>
      <Pressable
        style={styles.actionCardSnooze}
        onPress={onPressSnooze}
        android_ripple={{ color: 'rgba(217, 119, 6, 0.12)' }}
      >
        <Animated.View style={[styles.actionContent, animatedBadgeStyle]}>
          <View style={styles.iconCircleSnooze}>
            <AppIcon name="time-outline" size={17} color={Colors.white} />
          </View>
          <Text style={styles.snoozeTitle}>
            {language === 'hi' ? 'सणूज़' : 'Snooze'}
          </Text>
          <Text style={styles.snoozeSub}>
            {language === 'hi' ? '+2 दिन' : '+2 days'}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function SwipeableTaskItemComponent({
  children,
  language,
  onComplete,
  onSnooze,
  enabled = true,
  style,
}: SwipeableTaskItemProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const measuredHeight = useSharedValue<number>(0);
  const isCollapsing = useSharedValue<boolean>(false);
  const collapseProgress = useSharedValue<number>(0);

  const handleSnooze = () => {
    swipeableRef.current?.close();
    onSnooze?.(2);
  };

  const handleFinishComplete = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  const triggerCollapseAndComplete = () => {
    'worklet';
    if (isCollapsing.value) return;
    isCollapsing.value = true;
    collapseProgress.value = withTiming(
      1,
      { duration: 220, easing: Easing.bezier(0.25, 1, 0.5, 1) },
      (finished) => {
        'worklet';
        if (finished) {
          runOnJS(handleFinishComplete)();
        }
      }
    );
  };

  const animatedWrapperStyle = useAnimatedStyle(() => {
    if (!isCollapsing.value) {
      return {};
    }
    const currentHeight = measuredHeight.value > 0 ? measuredHeight.value : 76;
    const height = interpolate(
      collapseProgress.value,
      [0, 1],
      [currentHeight, 0],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      collapseProgress.value,
      [0, 0.4, 1],
      [1, 0.7, 0],
      Extrapolation.CLAMP
    );
    const marginBottom = interpolate(
      collapseProgress.value,
      [0, 1],
      [10, 0],
      Extrapolation.CLAMP
    );

    return {
      height,
      opacity,
      marginBottom,
      overflow: 'hidden',
    };
  });

  const renderLeftActions = (
    _progress: SharedValue<number>,
    translation: SharedValue<number>
  ) => {
    if (!onComplete) return null;
    return (
      <LeftActionContent
        translation={translation}
        language={language}
      />
    );
  };

  const renderRightActions = (
    _progress: SharedValue<number>,
    translation: SharedValue<number>
  ) => {
    return (
      <RightActionContent
        translation={translation}
        language={language}
        onPressSnooze={handleSnooze}
      />
    );
  };

  return (
    <Animated.View
      style={[styles.wrapper, style, animatedWrapperStyle]}
      onLayout={(e) => {
        if (!isCollapsing.value) {
          measuredHeight.value = e.nativeEvent.layout.height;
        }
      }}
    >
      <ReanimatedSwipeable
        ref={swipeableRef}
        enabled={enabled}
        friction={1} // Direct 1:1 finger tracking
        leftThreshold={110}
        rightThreshold={46}
        overshootLeft={false}
        overshootRight={false}
        animationOptions={{
          damping: 28,
          stiffness: 240,
          mass: 0.8,
          overshootClamping: true,
        }}
        renderLeftActions={onComplete ? renderLeftActions : undefined}
        renderRightActions={onSnooze ? renderRightActions : undefined}
        onSwipeableOpen={(direction) => {
          if (direction === SwipeDirection.RIGHT && onComplete) {
            triggerCollapseAndComplete();
          }
        }}
      >
        {children}
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

export const SwipeableTaskItem = React.memo(SwipeableTaskItemComponent, (prev, next) => {
  return (
    prev.enabled === next.enabled &&
    prev.language === next.language &&
    Boolean(prev.onComplete) === Boolean(next.onComplete) &&
    Boolean(prev.onSnooze) === Boolean(next.onSnooze) &&
    prev.children === next.children
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
    borderRadius: Radius.md,
  },
  leftActionContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  actionCardDone: {
    flex: 1,
    backgroundColor: '#ECFDF5', // Fresh, refined mint/emerald 50
    borderWidth: 1.5,
    borderColor: '#A7F3D0', // Emerald 200 border
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  doneContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    gap: 12,
  },
  iconCircleDone: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#059669', // Emerald 600
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  doneTextCol: {
    justifyContent: 'center',
  },
  doneTitle: {
    ...Typography.caption,
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: '#047857',
  },
  doneSub: {
    ...Typography.caption,
    fontSize: 10,
    fontFamily: 'Manrope_600SemiBold',
    color: '#065F46',
    marginTop: 1,
  },

  rightActionContainer: {
    width: 92,
    marginLeft: 8,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  actionCardSnooze: {
    flex: 1,
    backgroundColor: '#FFFBEB', // Warm amber 50
    borderWidth: 1.5,
    borderColor: '#FDE68A', // Amber 200 border
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  iconCircleSnooze: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D97706', // Amber 600
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  snoozeTitle: {
    ...Typography.caption,
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: '#B45309',
  },
  snoozeSub: {
    ...Typography.caption,
    fontSize: 9.5,
    fontFamily: 'Manrope_600SemiBold',
    color: '#92400E',
    marginTop: 1,
  },

  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

