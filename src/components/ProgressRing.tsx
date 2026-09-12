import React, { useEffect } from 'react';
import Svg, { Circle, G } from 'react-native-svg';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  percent: number;
  color: string;
  size?: number;
  stroke?: number;
  label?: string;
  labelColor?: string;
  trackColor?: string;
  animated?: boolean;
  testID?: string;
}

function StaticProgressRing({
  percent,
  color,
  size = 44,
  stroke = 4.5,
  label,
  labelColor = Colors.ink,
  trackColor,
  testID,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const center = size / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const strokeDashoffset = c * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} testID={testID}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor || Colors.ringTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <G transform={`rotate(-90 ${center} ${center})`}>
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={strokeDashoffset}
          />
        </G>
      </Svg>
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: labelColor,
              fontSize: size < 50 ? 9 : 10.5,
              lineHeight: size < 50 ? 9.5 : 12,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function AnimatedProgressRing({
  percent,
  color,
  size = 44,
  stroke = 4.5,
  label,
  labelColor = Colors.ink,
  trackColor,
  testID,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const center = size / 2;
  const c = 2 * Math.PI * r;

  const animatedPercent = useSharedValue(0);

  useEffect(() => {
    animatedPercent.value = withTiming(percent, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [percent, animatedPercent]);

  const animatedProps = useAnimatedProps(() => {
    const clamped = Math.max(0, Math.min(100, animatedPercent.value));
    const offset = c * (1 - clamped / 100);
    return {
      strokeDashoffset: offset,
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} testID={testID}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={trackColor || Colors.ringTrack}
          strokeWidth={stroke}
          fill="none"
        />
        <G transform={`rotate(-90 ${center} ${center})`}>
          <AnimatedCircle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: labelColor,
              fontSize: size < 50 ? 9 : 10.5,
              lineHeight: size < 50 ? 9.5 : 12,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export const ProgressRing = React.memo(function ProgressRing(props: ProgressRingProps) {
  if (props.animated) {
    return <AnimatedProgressRing {...props} />;
  }
  return <StaticProgressRing {...props} />;
});

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    fontFamily: 'Manrope_700Bold',
    textAlign: 'center',
    width: '90%',
  },
});
