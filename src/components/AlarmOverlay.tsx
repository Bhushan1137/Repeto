import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useAlarmListener } from '@/hooks/useAlarmListener';
import { Colors } from '@/constants/theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CHIME_AUDIO_SOURCE = require('../../assets/sounds/alarm_chime.wav');

export function AlarmOverlay() {
  const { activeAlarm, dismissAlarm, handleAlarmAction } = useAlarmListener();

  // Audio player with loop
  const player = useAudioPlayer(CHIME_AUDIO_SOURCE);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!activeAlarm) {
      try {
        player.pause();
      } catch {
        // ignore
      }
      Vibration.cancel();
      return;
    }

    // Play chime sound
    try {
      player.loop = true;
      player.play();
    } catch (err) {
      console.warn('[AlarmOverlay] Failed to play chime:', err);
    }

    // Start pulsing vibration pattern
    Vibration.vibrate([0, 500, 250, 500, 250, 500], true);

    // Pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.9,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
      try {
        player.pause();
      } catch {
        // ignore
      }
      Vibration.cancel();
    };
  }, [activeAlarm, player, pulseAnim, glowAnim]);

  if (!activeAlarm) {
    return null;
  }

  const onMarkDone = async () => {
    try {
      player.pause();
    } catch {
      // ignore
    }
    Vibration.cancel();
    await handleAlarmAction('MARK_DONE', activeAlarm.taskId);
  };

  const onSnooze = async () => {
    try {
      player.pause();
    } catch {
      // ignore
    }
    Vibration.cancel();
    await handleAlarmAction('SNOOZE_2D', activeAlarm.taskId);
  };

  const onDismiss = () => {
    try {
      player.pause();
    } catch {
      // ignore
    }
    Vibration.cancel();
    dismissAlarm();
  };

  return (
    <Modal
      visible={Boolean(activeAlarm)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.scrim}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(15, 23, 42, 0.9)" />

        <View style={styles.card}>
          {/* Glowing Animated Bell Badge */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.glowRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: glowAnim,
                },
              ]}
            />
            <View style={styles.iconBadge}>
              <MaterialCommunityIcons name="bell-ring" size={38} color={Colors.marigoldDeep} />
            </View>
          </View>

          {/* Alarm Tag */}
          <View style={styles.badgePill}>
            <MaterialCommunityIcons name="alarm" size={14} color={Colors.marigoldDeep} style={{ marginRight: 6 }} />
            <Text style={styles.badgeText}>TASK ALARM REMINDER</Text>
          </View>

          {/* Task Title */}
          <Text style={styles.title} numberOfLines={3}>
            {activeAlarm.title}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {"It's time to take action on your repeating task!"}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Mark Done Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.doneButton}
              onPress={onMarkDone}
            >
              <MaterialCommunityIcons name="check-circle" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.doneButtonText}>Mark Done</Text>
            </TouchableOpacity>

            {/* Snooze 2 Days Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.snoozeButton}
              onPress={onSnooze}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color="#E0E7FF" style={{ marginRight: 8 }} />
              <Text style={styles.snoozeButtonText}>Snooze 2 Days</Text>
            </TouchableOpacity>

            {/* Dismiss Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.dismissButton}
              onPress={onDismiss}
            >
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.25)',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  iconContainer: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  glowRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(232, 163, 61, 0.22)',
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(232, 163, 61, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(232, 163, 61, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 163, 61, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 61, 0.2)',
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: Colors.marigoldDeep,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Fraunces_700Bold',
    color: '#F8FAFC',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 15,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
  },
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#312E81',
    borderWidth: 1,
    borderColor: '#4F46E5',
    paddingVertical: 15,
    borderRadius: 16,
  },
  snoozeButtonText: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: '#E0E7FF',
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  dismissButtonText: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: '#94A3B8',
  },
});
