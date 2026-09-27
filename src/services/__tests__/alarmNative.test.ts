import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NativeModules, Platform } from 'react-native';
import {
  scheduleNativeAlarm,
  cancelNativeAlarm,
  cancelAllNativeAlarms,
  triggerTestAlarm,
  getInitialAlarmAction,
  addAlarmEventListener,
} from '../alarmNative';

describe('alarmNative service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('on Android platform with NativeModule present', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      NativeModules.AlarmModule = {
        scheduleAlarm: vi.fn().mockResolvedValue(true),
        cancelAlarm: vi.fn().mockResolvedValue(true),
        cancelAllAlarms: vi.fn().mockResolvedValue(true),
        triggerTestAlarm: vi.fn().mockResolvedValue(true),
        getInitialAlarmAction: vi.fn().mockResolvedValue({ action: 'MARK_DONE', taskId: 'task-1' }),
      };
    });

    it('scheduleNativeAlarm calls native module with taskId, title, and timestamp', async () => {
      const res = await scheduleNativeAlarm('task-123', 'Water Plants', 1700000000000);
      expect(res).toBe(true);
      expect(NativeModules.AlarmModule.scheduleAlarm).toHaveBeenCalledWith(
        'task-123',
        'Water Plants',
        1700000000000
      );
    });

    it('cancelNativeAlarm calls native module with taskId', async () => {
      const res = await cancelNativeAlarm('task-123');
      expect(res).toBe(true);
      expect(NativeModules.AlarmModule.cancelAlarm).toHaveBeenCalledWith('task-123');
    });

    it('cancelAllNativeAlarms calls native module cancelAllAlarms', async () => {
      const res = await cancelAllNativeAlarms();
      expect(res).toBe(true);
      expect(NativeModules.AlarmModule.cancelAllAlarms).toHaveBeenCalled();
    });

    it('triggerTestAlarm calls native module triggerTestAlarm', async () => {
      const res = await triggerTestAlarm(5, 'Test Alarm');
      expect(res).toBe(true);
      expect(NativeModules.AlarmModule.triggerTestAlarm).toHaveBeenCalledWith(5, 'Test Alarm');
    });

    it('getInitialAlarmAction returns action payload from native module', async () => {
      const res = await getInitialAlarmAction();
      expect(res).toEqual({ action: 'MARK_DONE', taskId: 'task-1' });
      expect(NativeModules.AlarmModule.getInitialAlarmAction).toHaveBeenCalled();
    });

    it('addAlarmEventListener registers a listener on DeviceEventEmitter', () => {
      const listener = vi.fn();
      const sub = addAlarmEventListener('onAlarmTriggered', listener);
      expect(sub).toBeDefined();
    });
  });

  describe('on non-Android platform or when NativeModule is missing', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
      NativeModules.AlarmModule = undefined;
    });

    it('scheduleNativeAlarm returns false gracefully without throwing', async () => {
      const res = await scheduleNativeAlarm('task-123', 'Water Plants', 1700000000000);
      expect(res).toBe(false);
    });

    it('cancelNativeAlarm returns false gracefully without throwing', async () => {
      const res = await cancelNativeAlarm('task-123');
      expect(res).toBe(false);
    });

    it('getInitialAlarmAction returns null', async () => {
      const res = await getInitialAlarmAction();
      expect(res).toBeNull();
    });
  });
});
