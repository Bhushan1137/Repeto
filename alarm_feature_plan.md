# Alarm-Type Notifications — Architectural Analysis & Implementation Plan

## What You're Asking For

A **full-screen alarm experience** when a task reminder fires:
- Covers the screen (even from lock screen / background)
- Plays a low, looping sound
- Shows task title + two actions: **Mark Done** / **Snooze**
- Dismisses itself when user acts

---

## Current State (Your App Today)

| Layer | What exists |
|---|---|
| Scheduling | `expo-notifications` — schedules local notifications per task |
| Channels | `default`, `household`, `promotions` on Android (HIGH importance) |
| Actions | `task-actions` category with `MARK_DONE` + `SNOOZE_2D` buttons |
| Handler | `setNotificationHandler` shows banner + sound |
| Tech stack | Expo SDK 57, React Native 0.86, Expo Router, **development client** (not bare workflow) |

The current setup gives a **standard banner notification** with action buttons. The user taps from the notification shade.

---

## Can We Implement a Real Alarm Experience?

**Yes — but with important platform constraints.**

### Android ✅ Fully Achievable

Android has a native concept called a **Full-Screen Intent (FSI)**. When a notification fires, instead of just showing a banner, it launches a full-screen `Activity`. This is exactly how alarm apps (Clock, Google Reminders) work.

**Requirements:**
- `USE_FULL_SCREEN_INTENT` permission (already declarable in `app.json`)
- A dedicated Android `Activity` that renders as the alarm UI
- A `BroadcastReceiver` to wake the screen + launch the Activity
- `SCHEDULE_EXACT_ALARM` ✅ (already in your `app.json` permissions)
- `WAKE_LOCK` permission (needed to wake screen)
- Custom sound file bundled as a raw resource

**Challenge:** `expo-notifications` does **not** support Full-Screen Intents out of the box. You need a **native module** (Expo Config Plugin) to inject the `Activity`, `BroadcastReceiver`, and `AndroidManifest.xml` entries. With your **development client** setup (`expo-dev-client`) this is 100% doable without ejecting — you write a config plugin + rebuild the dev client APK.

### iOS ⚠️ Partially Achievable

Apple's sandbox is much stricter:

| Feature | Possible? |
|---|---|
| Full-screen overlay from background | ❌ Not permitted (CallKit-only apps) |
| `UNNotificationContentExtension` | ✅ Custom notification UI with Mark Done/Snooze buttons in the expanded notification |
| Custom sound (looping) | ❌ iOS caps notification sounds at 30 seconds, no looping |
| In-app alarm modal when app is foreground | ✅ Fully controllable via `AppState` + foreground handler |

**Verdict for iOS:** You can get a **premium, expanded notification** with custom UI buttons, but not a true full-screen alarm overlay from the lock screen. The best iOS experience is: custom `UNNotificationContentExtension` (shows a styled card in the expanded notification) + full-screen modal when app is in foreground.

---

## Recommended Architecture

### Three-Layer Approach

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: Expo JS (existing)                                        │
│  expo-notifications scheduling + setNotificationHandler             │
│  + new AlarmOverlay modal (foreground case)                         │
└─────────────────────────────────────────────────────────────────────┘
         │ triggers
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 2: Android Native Module (Config Plugin)                     │
│  AlarmReceiver.kt (BroadcastReceiver)                               │
│  AlarmActivity.kt (Full-Screen Intent Activity)                     │
│  AlarmSound.mp3 bundled in res/raw/                                 │
│  AndroidManifest entries injected via Config Plugin                 │
└─────────────────────────────────────────────────────────────────────┘
         │ sends result back via
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: JS Bridge                                                 │
│  NativeModule (AlarmModule.kt) — exposes markDone(taskId) /         │
│  snooze(taskId, days) to JS side                                    │
│  On action: dispatches to existing task store (Firestore/SQLite)    │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### A. Expo Config Plugin (`plugins/withAlarm.js`)
- Injects `AlarmActivity`, `AlarmReceiver` into `AndroidManifest.xml`
- Adds `USE_FULL_SCREEN_INTENT`, `WAKE_LOCK`, `VIBRATE` permissions
- Copies `alarm_sound.mp3` to `android/app/src/main/res/raw/`
- Added to `app.json` → `plugins` array

#### B. Android Native (`android/` — auto-managed by config plugin)
- **`AlarmReceiver.kt`**: BroadcastReceiver woken by `expo-notifications` trigger. Acquires wake lock, launches `AlarmActivity` as Full-Screen Intent.
- **`AlarmActivity.kt`**: Standalone activity (not React Native). Shows task title + two buttons (Mark Done / Snooze). Plays looped sound via `MediaPlayer`. On button tap: calls `AlarmModule` JS bridge → dispatches to your store.
- **`AlarmModule.kt`**: NativeModule that exposes `markDone(taskId)` and `snooze(taskId, days)` to JavaScript.

#### C. JS-side `AlarmOverlay` Component (Foreground case)
- A `Modal` (transparent, `StatusBar` hidden) rendered over the app.
- Triggered by `expo-notifications` `addNotificationReceivedListener` when app is in **foreground**.
- Shows task name, animated pulsing icon, Mark Done / Snooze buttons.
- Plays sound via `expo-av` (low volume, looping).
- This covers the case where the user already has the app open.

#### D. `notifications.ts` — Alarm Channel
- New Android channel `alarm` with `AndroidImportance.MAX` + `enableVibrate` + `sound: 'alarm_sound'`
- Tasks with reminder get scheduled on this channel instead of `default`

---

## Effort Breakdown

| Phase | Task | Effort |
|---|---|---|
| 1 | Add `expo-av` for sound playback | 30 min |
| 2 | Build `AlarmOverlay` modal (JS) — foreground case | 2–3 hrs |
| 3 | Write `withAlarm` Config Plugin | 2–3 hrs |
| 4 | Write `AlarmActivity.kt` + `AlarmReceiver.kt` | 3–4 hrs |
| 5 | Write `AlarmModule.kt` (NativeModule) + bridge | 2 hrs |
| 6 | Rebuild dev client APK | 20–30 min (EAS Build) |
| 7 | iOS: `UNNotificationContentExtension` (optional) | 3–4 hrs |

**Total: ~2 days of focused work** (Android alarm) + optional iOS polish

---

## Open Questions

> [!IMPORTANT]
> **Q1 — Scope**: Do you want Android only first, or iOS in parallel?
> iOS requires an Xcode + Swift extension and App Store entitlement review. Android is much faster to ship.

> [!IMPORTANT]
> **Q2 — Sound**: Do you want to use a custom alarm sound (you provide `.mp3`) or should I generate/pick a soft chime?

> [!IMPORTANT]
> **Q3 — Snooze duration**: The current notification action says "Snooze 2 Days". For an alarm, should snooze mean **15 minutes / 1 hour** (alarm-style) instead of 2 days?

> [!IMPORTANT]
> **Q4 — Rebuild required**: This plan requires a **new development client build** (EAS Build, ~20–30 min). Are you ready for that?

---

## What We Do NOT Need

- ❌ Firebase Cloud Messaging (FCM) — all local, no server needed
- ❌ Ejecting from Expo — config plugins handle native code injection cleanly
- ❌ Any changes to your scheduling logic — just the channel changes in `notifications.ts`

---

## Proposed Changes (once approved)

### New Files
- `plugins/withAlarm.js` — Expo Config Plugin
- `src/components/AlarmOverlay.tsx` — Foreground alarm modal
- `src/hooks/useAlarmListener.ts` — Hook to subscribe to foreground notification events
- `assets/sounds/alarm_chime.mp3` — Soft alarm sound

### Modified Files
- [`app.json`](file:///f:/DEV/repeato/app.json) — Add `withAlarm` plugin + `USE_FULL_SCREEN_INTENT`/`WAKE_LOCK` permissions
- [`src/services/notifications.ts`](file:///f:/DEV/repeato/src/services/notifications.ts) — Add `alarm` channel, update task scheduling to use it
- [`app/_layout.tsx`](file:///f:/DEV/repeato/app/_layout.tsx) — Mount `<AlarmOverlay />` at root

### Native Files (auto-generated by config plugin on build)
- `android/app/src/main/java/.../AlarmActivity.kt`
- `android/app/src/main/java/.../AlarmReceiver.kt`
- `android/app/src/main/java/.../AlarmModule.kt`
- `android/app/src/main/res/raw/alarm_chime.mp3`
