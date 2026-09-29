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
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.app.NotificationManagerCompat

data class AlarmItem(
    val taskId: String,
    val title: String,
    val notificationId: Int,
    var snoozeCount: Int = 0
)

class AlarmActivity : Activity() {
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val activeAlarms = ArrayList<AlarmItem>()

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

        addAlarmFromIntent(intent)

        startAlarmSound()
        startVibrator()
        renderUI()

        // Start auto-snooze countdown (1 minute)
        autoSnoozeHandler.postDelayed(autoSnoozeRunnable, AUTO_SNOOZE_DELAY_MS)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        addAlarmFromIntent(intent)
        renderUI()
    }

    private fun addAlarmFromIntent(intent: Intent?) {
        if (intent == null) return
        val taskId = intent.getStringExtra("taskId") ?: ""
        if (taskId.isEmpty()) return
        val title = intent.getStringExtra("title") ?: "Task Reminder"
        val notificationId = intent.getIntExtra("notificationId", taskId.hashCode())
        val snoozeCount = intent.getIntExtra("snoozeCount", 0)

        val alreadyExists = activeAlarms.any { it.taskId == taskId }
        if (!alreadyExists) {
            activeAlarms.add(AlarmItem(taskId, title, notificationId, snoozeCount))
        }
    }

    /**
     * Called when user ignores the alarm session for 1 minute.
     * Snoozes or marks missed for all remaining active alarms.
     */
    private fun autoSnoozeOrMiss() {
        stopAlarm()
        for (item in activeAlarms) {
            NotificationManagerCompat.from(this).cancel(item.notificationId)

            if (item.snoozeCount == 0) {
                // First miss — auto-snooze 15 minutes
                val snoozeTime = System.currentTimeMillis() + AUTO_SNOOZE_DURATION_MS
                AlarmReceiver.schedule(this, item.taskId, item.title, snoozeTime, snoozeCount = 1)
                AlarmModule.notifyAction("SNOOZE_AUTO", item.taskId)
            } else {
                // Second miss — show missed notification
                AlarmReceiver.showMissedNotification(this, item.taskId, item.title, item.notificationId)
                AlarmModule.notifyAction("MISSED", item.taskId)
            }
        }
        activeAlarms.clear()
        finishAndRemoveTask()
    }

    private fun startAlarmSound() {
        if (mediaPlayer != null) return // Only start one audio player
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
        if (vibrator != null) return // Only start one vibrator
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

    private fun bringAppToForeground(action: String, taskId: String, taskIds: ArrayList<String>? = null) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            putExtra("alarmAction", action)
            putExtra("taskId", taskId)
            if (taskIds != null) {
                putStringArrayListExtra("taskIds", taskIds)
            }
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        if (launchIntent != null) {
            startActivity(launchIntent)
        }
    }

    private fun renderUI() {
        if (activeAlarms.isEmpty()) {
            autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
            stopAlarm()
            finishAndRemoveTask()
            return
        }

        val isMulti = activeAlarms.size > 1

        val rootScroll = ScrollView(this).apply {
            isFillViewport = true
            setBackgroundColor(Color.parseColor("#171B36"))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            val padH = dp(24)
            val padV = dp(32)
            setPadding(padH, padV, padH, padV)
        }
        rootScroll.addView(root)

        // 1. Glowing Icon Badge
        val iconBadge = TextView(this).apply {
            text = "⏰"
            textSize = if (isMulti) 36f else 48f
            gravity = Gravity.CENTER
            val size = if (isMulti) dp(72) else dp(96)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = dp(16)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#262D4A"))
                setStroke(dp(2), Color.parseColor("#E8A33D"))
            }
        }
        root.addView(iconBadge)

        // 2. Pill Tag
        val pill = TextView(this).apply {
            text = if (isMulti) "${activeAlarms.size} TASKS DUE" else "REPETO ALARM REMINDER"
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
                bottomMargin = dp(16)
            }
        }
        root.addView(pill)

        // 3. Header Title & Subtitle
        if (isMulti) {
            val multiTitle = TextView(this).apply {
                text = "Repeating Tasks Due"
                textSize = 22f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#FFFFFF"))
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dp(6)
                }
            }
            root.addView(multiTitle)

            val multiSub = TextView(this).apply {
                text = "Multiple tasks scheduled right now. Take action below:"
                textSize = 14f
                setTextColor(Color.parseColor("#94A3B8"))
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dp(24)
                }
            }
            root.addView(multiSub)

            // Multi-task list cards
            for (alarmItem in ArrayList(activeAlarms)) {
                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    background = GradientDrawable().apply {
                        cornerRadius = dp(16).toFloat()
                        setColor(Color.parseColor("#1F2644"))
                        setStroke(dp(1), Color.parseColor("#374151"))
                    }
                    val p = dp(16)
                    setPadding(p, p, p, p)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = dp(14)
                    }
                }

                // Task title
                val itemTitle = TextView(this).apply {
                    text = alarmItem.title
                    textSize = 17f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.parseColor("#FFFFFF"))
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = dp(12)
                    }
                }
                card.addView(itemTitle)

                // Action buttons row for this task
                val btnRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                }

                // Single task Done button
                val taskDoneBtn = Button(this).apply {
                    text = "✓ Done"
                    textSize = 14f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.parseColor("#FFFFFF"))
                    background = GradientDrawable().apply {
                        cornerRadius = dp(12).toFloat()
                        setColor(Color.parseColor("#16A34A"))
                    }
                    layoutParams = LinearLayout.LayoutParams(0, dp(44), 1f).apply {
                        rightMargin = dp(8)
                    }
                    setOnClickListener {
                        NotificationManagerCompat.from(this@AlarmActivity).cancel(alarmItem.notificationId)
                        AlarmModule.recordAction(this@AlarmActivity, "MARK_DONE", alarmItem.taskId)
                        activeAlarms.removeAll { it.taskId == alarmItem.taskId }

                        if (activeAlarms.isEmpty()) {
                            autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                            stopAlarm()
                            bringAppToForeground("MARK_DONE", alarmItem.taskId)
                            finishAndRemoveTask()
                        } else {
                            renderUI()
                        }
                    }
                }
                btnRow.addView(taskDoneBtn)

                // Single task Snooze button
                val taskSnoozeBtn = Button(this).apply {
                    text = "⏱ Snooze 2d"
                    textSize = 14f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.parseColor("#E0E7FF"))
                    background = GradientDrawable().apply {
                        cornerRadius = dp(12).toFloat()
                        setColor(Color.parseColor("#312E81"))
                        setStroke(dp(1), Color.parseColor("#4F46E5"))
                    }
                    layoutParams = LinearLayout.LayoutParams(0, dp(44), 1f)
                    setOnClickListener {
                        NotificationManagerCompat.from(this@AlarmActivity).cancel(alarmItem.notificationId)
                        val snoozeTime = System.currentTimeMillis() + (2L * 24 * 60 * 60 * 1000)
                        AlarmReceiver.schedule(this@AlarmActivity, alarmItem.taskId, alarmItem.title, snoozeTime)
                        AlarmModule.recordAction(this@AlarmActivity, "SNOOZE_2D", alarmItem.taskId)
                        activeAlarms.removeAll { it.taskId == alarmItem.taskId }

                        if (activeAlarms.isEmpty()) {
                            autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                            stopAlarm()
                            bringAppToForeground("SNOOZE_2D", alarmItem.taskId)
                            finishAndRemoveTask()
                        } else {
                            renderUI()
                        }
                    }
                }
                btnRow.addView(taskSnoozeBtn)

                card.addView(btnRow)
                root.addView(card)
            }

            // Batch Action Buttons Container
            val batchContainer = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = dp(8)
                }
            }

            // 1. Mark All Done Button
            val markAllBtn = Button(this).apply {
                text = "✓  Mark All Done (${activeAlarms.size})"
                textSize = 16f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#FFFFFF"))
                background = GradientDrawable().apply {
                    cornerRadius = dp(16).toFloat()
                    setColor(Color.parseColor("#16A34A"))
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(52)
                ).apply {
                    bottomMargin = dp(12)
                }
                setOnClickListener {
                    autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                    stopAlarm()
                    val taskIds = ArrayList<String>()
                    for (item in activeAlarms) {
                        NotificationManagerCompat.from(this@AlarmActivity).cancel(item.notificationId)
                        AlarmModule.recordAction(this@AlarmActivity, "MARK_DONE", item.taskId)
                        taskIds.add(item.taskId)
                    }
                    val lastTaskId = activeAlarms.lastOrNull()?.taskId ?: ""
                    activeAlarms.clear()
                    bringAppToForeground("MARK_DONE", lastTaskId, taskIds)
                    finishAndRemoveTask()
                }
            }
            batchContainer.addView(markAllBtn)

            // 2. Snooze All (2 Days) Button
            val snoozeAllBtn = Button(this).apply {
                text = "⏱  Snooze All (2 Days)"
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#E0E7FF"))
                background = GradientDrawable().apply {
                    cornerRadius = dp(14).toFloat()
                    setColor(Color.parseColor("#252B4B"))
                    setStroke(dp(1), Color.parseColor("#4F46E5"))
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(48)
                ).apply {
                    bottomMargin = dp(12)
                }
                setOnClickListener {
                    autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                    stopAlarm()
                    val snoozeTime = System.currentTimeMillis() + (2L * 24 * 60 * 60 * 1000)
                    val taskIds = ArrayList<String>()
                    for (item in activeAlarms) {
                        NotificationManagerCompat.from(this@AlarmActivity).cancel(item.notificationId)
                        AlarmReceiver.schedule(this@AlarmActivity, item.taskId, item.title, snoozeTime)
                        AlarmModule.recordAction(this@AlarmActivity, "SNOOZE_2D", item.taskId)
                        taskIds.add(item.taskId)
                    }
                    val lastTaskId = activeAlarms.lastOrNull()?.taskId ?: ""
                    activeAlarms.clear()
                    bringAppToForeground("SNOOZE_2D", lastTaskId, taskIds)
                    finishAndRemoveTask()
                }
            }
            batchContainer.addView(snoozeAllBtn)

            // 3. Dismiss All Button
            val dismissAllBtn = TextView(this).apply {
                text = "Dismiss All"
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
                    for (item in activeAlarms) {
                        NotificationManagerCompat.from(this@AlarmActivity).cancel(item.notificationId)
                    }
                    activeAlarms.clear()
                    finishAndRemoveTask()
                }
            }
            batchContainer.addView(dismissAllBtn)

            root.addView(batchContainer)

        } else {
            // Single Task View
            val singleItem = activeAlarms[0]

            val titleView = TextView(this).apply {
                text = singleItem.title
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
                    NotificationManagerCompat.from(this@AlarmActivity).cancel(singleItem.notificationId)
                    AlarmModule.recordAction(this@AlarmActivity, "MARK_DONE", singleItem.taskId)
                    bringAppToForeground("MARK_DONE", singleItem.taskId)
                    activeAlarms.clear()
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
                    NotificationManagerCompat.from(this@AlarmActivity).cancel(singleItem.notificationId)
                    val snoozeTime = System.currentTimeMillis() + (2L * 24 * 60 * 60 * 1000)
                    AlarmReceiver.schedule(this@AlarmActivity, singleItem.taskId, singleItem.title, snoozeTime)
                    AlarmModule.recordAction(this@AlarmActivity, "SNOOZE_2D", singleItem.taskId)
                    bringAppToForeground("SNOOZE_2D", singleItem.taskId)
                    activeAlarms.clear()
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
                    NotificationManagerCompat.from(this@AlarmActivity).cancel(singleItem.notificationId)
                    activeAlarms.clear()
                    finishAndRemoveTask()
                }
            }
            actionsContainer.addView(dismissBtn)

            root.addView(actionsContainer)
        }

        setContentView(rootScroll)
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
