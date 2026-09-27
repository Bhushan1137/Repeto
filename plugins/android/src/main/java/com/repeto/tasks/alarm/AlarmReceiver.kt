package com.repeto.tasks.alarm

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class AlarmReceiver : BroadcastReceiver() {
    companion object {
        const val TAG = "AlarmReceiver"
        const val CHANNEL_ID = "alarm"
        const val ACTION_ALARM_TRIGGER = "com.repeto.tasks.ALARM_TRIGGER"
        const val ACTION_MARK_DONE = "com.repeto.tasks.ALARM_ACTION_DONE"
        const val ACTION_SNOOZE = "com.repeto.tasks.ALARM_ACTION_SNOOZE"
        const val ACTION_DISMISS = "com.repeto.tasks.ALARM_DISMISS"

        fun schedule(context: Context, taskId: String, title: String, triggerAtMillis: Long) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = ACTION_ALARM_TRIGGER
                putExtra("taskId", taskId)
                putExtra("title", title)
                putExtra("notificationId", taskId.hashCode())
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                taskId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                }
                Log.d(TAG, "Scheduled alarm for task $taskId at $triggerAtMillis")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to schedule alarm: ${e.message}", e)
            }
        }

        fun cancel(context: Context, taskId: String) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = ACTION_ALARM_TRIGGER
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                taskId.hashCode(),
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
            NotificationManagerCompat.from(context).cancel(taskId.hashCode())
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val taskId = intent.getStringExtra("taskId") ?: ""
        val title = intent.getStringExtra("title") ?: "Task Reminder"
        val notificationId = intent.getIntExtra("notificationId", taskId.hashCode())

        Log.d(TAG, "Received action: $action for taskId: $taskId")

        when (action) {
            ACTION_ALARM_TRIGGER -> {
                handleAlarmTrigger(context, taskId, title, notificationId)
            }
            ACTION_MARK_DONE -> {
                handleMarkDone(context, taskId, notificationId)
            }
            ACTION_SNOOZE -> {
                handleSnooze(context, taskId, title, notificationId)
            }
            ACTION_DISMISS -> {
                NotificationManagerCompat.from(context).cancel(notificationId)
            }
        }
    }

    private fun handleAlarmTrigger(context: Context, taskId: String, title: String, notificationId: Int) {
        // 1. Acquire temporary wake lock to ensure CPU is awake
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "repeto:alarm_trigger_wakelock"
        )
        wakeLock?.acquire(10 * 1000L)

        // 2. Ensure notification channel exists
        createAlarmChannel(context)

        // 3. Full-Screen Intent pointing to AlarmActivity
        val fullScreenIntent = Intent(context, AlarmActivity::class.java).apply {
            putExtra("taskId", taskId)
            putExtra("title", title)
            putExtra("notificationId", notificationId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 4. Action intents for Notification shade buttons
        val doneIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_MARK_DONE
            putExtra("taskId", taskId)
            putExtra("notificationId", notificationId)
        }
        val donePendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + 1,
            doneIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val snoozeIntent = Intent(context, AlarmReceiver::class.java).apply {
            action = ACTION_SNOOZE
            putExtra("taskId", taskId)
            putExtra("title", title)
            putExtra("notificationId", notificationId)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            notificationId + 2,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val smallIcon = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
            .takeIf { it != 0 } ?: android.R.drawable.ic_lock_idle_alarm

        val soundResId = context.resources.getIdentifier("alarm_chime", "raw", context.packageName)
        val soundUri = if (soundResId != 0) {
            Uri.parse("android.resource://${context.packageName}/$soundResId")
        } else {
            android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon)
            .setContentTitle("⏰ Repeto Reminder")
            .setContentText(title)
            .setStyle(NotificationCompat.BigTextStyle().bigText("Time for: $title"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(Color.parseColor("#E8A33D"))
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setAutoCancel(true)
            .setOngoing(true)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 500, 250, 500, 250, 500))
            .addAction(0, "Mark Done", donePendingIntent)
            .addAction(0, "Snooze 2 Days", snoozePendingIntent)

        try {
            NotificationManagerCompat.from(context).notify(notificationId, builder.build())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to display notification: ${e.message}", e)
        }

        // Notify active React Native bridge if running
        AlarmModule.notifyTrigger(taskId, title)
    }

    private fun handleMarkDone(context: Context, taskId: String, notificationId: Int) {
        NotificationManagerCompat.from(context).cancel(notificationId)
        AlarmModule.notifyAction("MARK_DONE", taskId)

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            putExtra("alarmAction", "MARK_DONE")
            putExtra("taskId", taskId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        if (launchIntent != null) {
            context.startActivity(launchIntent)
        }
    }

    private fun handleSnooze(context: Context, taskId: String, title: String, notificationId: Int) {
        NotificationManagerCompat.from(context).cancel(notificationId)
        // Snooze 2 days in milliseconds
        val snoozeTime = System.currentTimeMillis() + (2L * 24 * 60 * 60 * 1000)
        schedule(context, taskId, title, snoozeTime)
        AlarmModule.notifyAction("SNOOZE_2D", taskId)

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            putExtra("alarmAction", "SNOOZE_2D")
            putExtra("taskId", taskId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        if (launchIntent != null) {
            context.startActivity(launchIntent)
        }
    }

    private fun createAlarmChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val soundResId = context.resources.getIdentifier("alarm_chime", "raw", context.packageName)
            val soundUri = if (soundResId != 0) {
                Uri.parse("android.resource://${context.packageName}/$soundResId")
            } else {
                android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI
            }

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                CHANNEL_ID,
                "Task Alarm Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High-priority alarm notifications for repeating task reminders"
                setSound(soundUri, audioAttributes)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 500)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                enableLights(true)
                lightColor = Color.parseColor("#E8A33D")
                setBypassDnd(true)
            }

            notificationManager.createNotificationChannel(channel)
        }
    }
}
