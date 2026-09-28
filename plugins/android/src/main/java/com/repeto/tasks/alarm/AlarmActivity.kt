package com.repeto.tasks.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationManagerCompat

class AlarmActivity : Activity() {
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var taskId: String = ""
    private var title: String = ""
    private var notificationId: Int = 1001
    private var snoozeCount: Int = 0

    // Auto-snooze: dismiss after 1 min if user doesn't interact
    private val autoSnoozeHandler = Handler(Looper.getMainLooper())
    private val autoSnoozeRunnable = Runnable { autoSnoozeOrMiss() }
    private val AUTO_SNOOZE_DELAY_MS = 60 * 1000L  // 1 minute
    private val AUTO_SNOOZE_DURATION_MS = 15 * 60 * 1000L // 15 minutes

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Wake screen, bypass keyguard, keep screen on
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        taskId = intent.getStringExtra("taskId") ?: ""
        title = intent.getStringExtra("title") ?: "Task Reminder"
        notificationId = intent.getIntExtra("notificationId", taskId.hashCode())
        snoozeCount = intent.getIntExtra("snoozeCount", 0)

        startAlarmSound()
        startVibrator()
        setupUI()

        // Start auto-snooze countdown (1 minute)
        autoSnoozeHandler.postDelayed(autoSnoozeRunnable, AUTO_SNOOZE_DELAY_MS)
    }

    /**
     * Called when user ignores the alarm for 1 minute.
     * First miss:  auto-snooze for 15 min (snoozeCount becomes 1)
     * Second miss: show "Missed Reminder" notification and dismiss
     */
    private fun autoSnoozeOrMiss() {
        stopAlarm()
        NotificationManagerCompat.from(this).cancel(notificationId)

        if (snoozeCount == 0) {
            // First miss — auto-snooze 15 minutes
            val snoozeTime = System.currentTimeMillis() + AUTO_SNOOZE_DURATION_MS
            AlarmReceiver.schedule(this, taskId, title, snoozeTime, snoozeCount = 1)
            AlarmModule.notifyAction("SNOOZE_AUTO", taskId)
        } else {
            // Second miss — show missed notification, no further re-scheduling
            AlarmReceiver.showMissedNotification(this, taskId, title, notificationId)
            AlarmModule.notifyAction("MISSED", taskId)
        }

        finishAndRemoveTask()
    }

    private fun startAlarmSound() {
        try {
            val soundResId = resources.getIdentifier("alarm_chime", "raw", packageName)
            if (soundResId != 0) {
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                mediaPlayer = MediaPlayer.create(this, soundResId, audioAttributes, 0)
            }

            if (mediaPlayer == null) {
                val alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                mediaPlayer = MediaPlayer().apply {
                    setDataSource(this@AlarmActivity, alertUri)
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    prepare()
                }
            }

            mediaPlayer?.apply {
                isLooping = true
                setVolume(1.0f, 1.0f)
                start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startVibrator() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            val pattern = longArrayOf(0, 500, 250, 500, 250, 500)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopAlarm() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {
            // ignore
        }
        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            // ignore
        }
    }

    private fun setupUI() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#171B36"))
            val pad = dp(28)
            setPadding(pad, pad, pad, pad)
        }

        // Glowing Icon Badge
        val iconBadge = TextView(this).apply {
            text = "⏰"
            textSize = 48f
            gravity = Gravity.CENTER
            val size = dp(96)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = dp(20)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#262D4A"))
                setStroke(dp(2), Color.parseColor("#E8A33D"))
            }
        }
        root.addView(iconBadge)

        // Pill Tag: "REPETO ALARM REMINDER"
        val pill = TextView(this).apply {
            text = "REPETO ALARM REMINDER"
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#E8A33D"))
            gravity = Gravity.CENTER
            setPadding(dp(14), dp(6), dp(14), dp(6))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#242B48"))
                setStroke(dp(1), Color.parseColor("#E8A33D"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(18)
            }
        }
        root.addView(pill)

        // Task Title
        val titleView = TextView(this).apply {
            text = title
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#FFFFFF"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(10)
            }
        }
        root.addView(titleView)

        // Subtitle
        val subView = TextView(this).apply {
            text = "Time to take action on your repeating task!"
            textSize = 15f
            setTextColor(Color.parseColor("#94A3B8"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(36)
            }
        }
        root.addView(subView)

        // Actions Container
        val actionsContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        // 1. Mark Done Button
        val doneBtn = Button(this).apply {
            text = "✓  Mark Done"
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#FFFFFF"))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#16A34A"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(54)
            ).apply {
                bottomMargin = dp(14)
            }
            setOnClickListener {
                autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                stopAlarm()
                NotificationManagerCompat.from(this@AlarmActivity).cancel(notificationId)
                AlarmModule.notifyAction("MARK_DONE", taskId)

                val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                    putExtra("alarmAction", "MARK_DONE")
                    putExtra("taskId", taskId)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                if (launchIntent != null) {
                    startActivity(launchIntent)
                }
                finishAndRemoveTask()
            }
        }
        actionsContainer.addView(doneBtn)

        // 2. Snooze 2 Days Button
        val snoozeBtn = Button(this).apply {
            text = "⏱  Snooze 2 Days"
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#E0E7FF"))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#312E81"))
                setStroke(dp(1), Color.parseColor("#4F46E5"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(54)
            ).apply {
                bottomMargin = dp(14)
            }
            setOnClickListener {
                autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                stopAlarm()
                NotificationManagerCompat.from(this@AlarmActivity).cancel(notificationId)
                val snoozeTime = System.currentTimeMillis() + (2L * 24 * 60 * 60 * 1000)
                AlarmReceiver.schedule(this@AlarmActivity, taskId, title, snoozeTime)
                AlarmModule.notifyAction("SNOOZE_2D", taskId)

                val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                    putExtra("alarmAction", "SNOOZE_2D")
                    putExtra("taskId", taskId)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                if (launchIntent != null) {
                    startActivity(launchIntent)
                }
                finishAndRemoveTask()
            }
        }
        actionsContainer.addView(snoozeBtn)

        // 3. Dismiss Button
        val dismissBtn = TextView(this).apply {
            text = "Dismiss"
            textSize = 14f
            setTextColor(Color.parseColor("#94A3B8"))
            gravity = Gravity.CENTER
            val p = dp(12)
            setPadding(p, p, p, p)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener {
                autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                stopAlarm()
                NotificationManagerCompat.from(this@AlarmActivity).cancel(notificationId)
                finishAndRemoveTask()
            }
        }
        actionsContainer.addView(dismissBtn)

        root.addView(actionsContainer)
        setContentView(root)
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    override fun onDestroy() {
        autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
        stopAlarm()
        super.onDestroy()
    }
}
