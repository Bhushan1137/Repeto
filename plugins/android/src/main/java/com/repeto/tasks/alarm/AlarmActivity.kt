package com.repeto.tasks.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
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
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
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

class GoldenWaveView(context: Context) : View(context) {
    private val strokePaint1 = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f * context.resources.displayMetrics.density
        color = Color.parseColor("#59F5B74F")
    }
    private val strokePaint2 = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f * context.resources.displayMetrics.density
        color = Color.parseColor("#33E8A33D")
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0 || h <= 0) return

        val shader = LinearGradient(
            0f, h * 0.2f, 0f, h,
            Color.parseColor("#2EE8A33D"),
            Color.parseColor("#04080F"),
            Shader.TileMode.CLAMP
        )
        fillPaint.shader = shader

        val pathFill = Path().apply {
            moveTo(0f, h * 0.45f)
            cubicTo(w * 0.25f, h * 0.2f, w * 0.65f, h * 0.7f, w, h * 0.5f)
            lineTo(w, h)
            lineTo(0f, h)
            close()
        }
        canvas.drawPath(pathFill, fillPaint)

        val pathStroke1 = Path().apply {
            moveTo(0f, h * 0.45f)
            cubicTo(w * 0.25f, h * 0.2f, w * 0.65f, h * 0.7f, w, h * 0.5f)
        }
        canvas.drawPath(pathStroke1, strokePaint1)

        val pathStroke2 = Path().apply {
            moveTo(0f, h * 0.55f)
            cubicTo(w * 0.35f, h * 0.35f, w * 0.75f, h * 0.75f, w, h * 0.6f)
        }
        canvas.drawPath(pathStroke2, strokePaint2)
    }
}

class AlarmActivity : Activity() {
    companion object {
        const val TAG = "AlarmActivity"
    }

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val activeAlarms = ArrayList<AlarmItem>()
    private var isSilenced = false
    private var screenOffReceiver: BroadcastReceiver? = null

    // Auto-snooze: dismiss after 1 min if user doesn't interact
    private val autoSnoozeHandler = Handler(Looper.getMainLooper())
    private val autoSnoozeRunnable = Runnable { autoSnoozeOrMiss() }
    private val AUTO_SNOOZE_DELAY_MS = 60 * 1000L  // 1 minute
    private val AUTO_SNOOZE_DURATION_MS = 15 * 60 * 1000L // 15 minutes

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show directly over lock screen without unlocking device
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        addAlarmFromIntent(intent)

        startAlarmSound()
        startVibrator()
        registerScreenOffReceiver()
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

    private fun registerScreenOffReceiver() {
        if (screenOffReceiver != null) return
        screenOffReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == Intent.ACTION_SCREEN_OFF) {
                    Log.d(TAG, "Screen off detected (Power button pressed) -> silencing alarm")
                    silenceAlarm()
                }
            }
        }
        try {
            val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
            registerReceiver(screenOffReceiver, filter)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to register screenOffReceiver: ${e.message}")
        }
    }

    private fun unregisterScreenOffReceiver() {
        screenOffReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (e: Exception) {
                // ignore
            }
            screenOffReceiver = null
        }
    }

    private fun silenceAlarm() {
        if (isSilenced) return
        isSilenced = true
        Log.d(TAG, "Silencing alarm sound and vibration via hardware button / screen off")
        stopAlarm()
        for (item in activeAlarms) {
            try {
                NotificationManagerCompat.from(this).cancel(item.notificationId)
            } catch (e: Exception) {
                // ignore
            }
        }
        runOnUiThread {
            renderUI()
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_VOLUME_UP,
                KeyEvent.KEYCODE_VOLUME_DOWN,
                KeyEvent.KEYCODE_VOLUME_MUTE,
                KeyEvent.KEYCODE_POWER -> {
                    Log.d(TAG, "Hardware key pressed (${event.keyCode}) -> silencing alarm")
                    silenceAlarm()
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP,
            KeyEvent.KEYCODE_VOLUME_DOWN,
            KeyEvent.KEYCODE_VOLUME_MUTE,
            KeyEvent.KEYCODE_POWER -> {
                Log.d(TAG, "onKeyDown (${keyCode}) -> silencing alarm")
                silenceAlarm()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onStop() {
        super.onStop()
        // If activity stopped (e.g. screen turned off by Power button), ensure alarm is silenced
        silenceAlarm()
    }

    private fun bringAppToForeground(action: String, taskId: String, taskIds: ArrayList<String>? = null) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        }
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

        val rootFrame = FrameLayout(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.parseColor("#0D1322"), Color.parseColor("#080B14"))
            )
        }

        // Ambient golden wave ribbons at bottom
        val waveView = GoldenWaveView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(220)
            ).apply {
                gravity = Gravity.BOTTOM
            }
        }
        rootFrame.addView(waveView)

        val rootScroll = ScrollView(this).apply {
            isFillViewport = true
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            val padH = dp(24)
            val padV = dp(36)
            setPadding(padH, padV, padH, padV)
        }
        rootScroll.addView(root)

        // 1. Glowing Alarm Badge Container
        val iconBadge = TextView(this).apply {
            text = if (isSilenced) "🔕" else "⏰"
            textSize = if (isMulti) 36f else 46f
            gravity = Gravity.CENTER
            val size = if (isMulti) dp(76) else dp(96)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                bottomMargin = dp(16)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#151B2E"))
                setStroke(dp(2f), if (isSilenced) Color.parseColor("#94A3B8") else Color.parseColor("#F5B74F"))
            }
        }
        root.addView(iconBadge)

        // 2. Pill Tag
        val pill = TextView(this).apply {
            text = if (isSilenced) "🔕 ALARM SILENCED" else (if (isMulti) "${activeAlarms.size} TASKS DUE" else "REPETO ALARM REMINDER")
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(if (isSilenced) Color.parseColor("#94A3B8") else Color.parseColor("#F5B74F"))
            gravity = Gravity.CENTER
            setPadding(dp(18), dp(7), dp(18), dp(7))
            background = GradientDrawable().apply {
                cornerRadius = dp(18).toFloat()
                setColor(Color.parseColor("#151B2E"))
                setStroke(dp(1.5f), if (isSilenced) Color.parseColor("#94A3B8") else Color.parseColor("#F5B74F"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(20)
            }
        }
        root.addView(pill)

        // 3. Header Title & Subtitle
        if (isMulti) {
            val multiTitle = TextView(this).apply {
                text = "Repeating Tasks Due"
                textSize = 24f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#FFFFFF"))
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dp(8)
                }
            }
            root.addView(multiTitle)

            val multiSub = TextView(this).apply {
                text = if (isSilenced) "Alarm silenced via button. Take action below:" else "Multiple tasks scheduled right now. Take action below:"
                textSize = 15f
                setTextColor(Color.parseColor("#8F9BB3"))
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dp(28)
                }
            }
            root.addView(multiSub)

            // Multi-task list cards
            for (alarmItem in ArrayList(activeAlarms)) {
                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    background = GradientDrawable().apply {
                        cornerRadius = dp(16).toFloat()
                        setColor(Color.parseColor("#12182D"))
                        setStroke(dp(1.5f), Color.parseColor("#F5B74F"))
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
                    textSize = 18f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.parseColor("#FFFFFF"))
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = dp(14)
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

                // Single task Done button (Golden Gradient)
                val taskDoneBtn = Button(this).apply {
                    text = "✓ DONE"
                    textSize = 14f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.parseColor("#121626"))
                    background = GradientDrawable(
                        GradientDrawable.Orientation.TOP_BOTTOM,
                        intArrayOf(Color.parseColor("#FFBE4B"), Color.parseColor("#F29D26"))
                    ).apply {
                        cornerRadius = dp(20).toFloat()
                    }
                    layoutParams = LinearLayout.LayoutParams(0, dp(46), 1f).apply {
                        rightMargin = dp(10)
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

                // Single task Snooze button (Dark with Gold outline)
                val taskSnoozeBtn = Button(this).apply {
                    text = "⏱ SNOOZE 10M"
                    textSize = 13f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.parseColor("#FFFFFF"))
                    background = GradientDrawable().apply {
                        cornerRadius = dp(20).toFloat()
                        setColor(Color.parseColor("#10162A"))
                        setStroke(dp(1.5f), Color.parseColor("#F5B74F"))
                    }
                    layoutParams = LinearLayout.LayoutParams(0, dp(46), 1f)
                    setOnClickListener {
                        NotificationManagerCompat.from(this@AlarmActivity).cancel(alarmItem.notificationId)
                        val snoozeTime = System.currentTimeMillis() + (10L * 60 * 1000)
                        AlarmReceiver.schedule(this@AlarmActivity, alarmItem.taskId, alarmItem.title, snoozeTime)
                        AlarmModule.recordAction(this@AlarmActivity, "SNOOZE_10M", alarmItem.taskId)
                        activeAlarms.removeAll { it.taskId == alarmItem.taskId }

                        if (activeAlarms.isEmpty()) {
                            autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                            stopAlarm()
                            bringAppToForeground("SNOOZE_10M", alarmItem.taskId)
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

            // 1. Mark All Done Button (Golden Gradient with Dark Text)
            val markAllBtn = Button(this).apply {
                text = "✓  MARK ALL DONE (${activeAlarms.size})"
                textSize = 16f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#121626"))
                background = GradientDrawable(
                    GradientDrawable.Orientation.TOP_BOTTOM,
                    intArrayOf(Color.parseColor("#FFBE4B"), Color.parseColor("#F29D26"))
                ).apply {
                    cornerRadius = dp(26).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(56)
                ).apply {
                    bottomMargin = dp(14)
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

            // 2. Snooze All (10 Min) Button (Dark with Gold outline)
            val snoozeAllBtn = Button(this).apply {
                text = "⏱  SNOOZE ALL (10 MIN)"
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#FFFFFF"))
                background = GradientDrawable().apply {
                    cornerRadius = dp(26).toFloat()
                    setColor(Color.parseColor("#10162A"))
                    setStroke(dp(1.5f), Color.parseColor("#F5B74F"))
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(54)
                ).apply {
                    bottomMargin = dp(16)
                }
                setOnClickListener {
                    autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                    stopAlarm()
                    val snoozeTime = System.currentTimeMillis() + (10L * 60 * 1000)
                    val taskIds = ArrayList<String>()
                    for (item in activeAlarms) {
                        NotificationManagerCompat.from(this@AlarmActivity).cancel(item.notificationId)
                        AlarmReceiver.schedule(this@AlarmActivity, item.taskId, item.title, snoozeTime)
                        AlarmModule.recordAction(this@AlarmActivity, "SNOOZE_10M", item.taskId)
                        taskIds.add(item.taskId)
                    }
                    val lastTaskId = activeAlarms.lastOrNull()?.taskId ?: ""
                    activeAlarms.clear()
                    bringAppToForeground("SNOOZE_10M", lastTaskId, taskIds)
                    finishAndRemoveTask()
                }
            }
            batchContainer.addView(snoozeAllBtn)

            // 3. Dismiss All Button
            val dismissAllBtn = TextView(this).apply {
                text = "Dismiss All"
                textSize = 14f
                setTextColor(Color.parseColor("#758296"))
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
                textSize = 28f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#FFFFFF"))
                gravity = Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dp(8)
                }
            }
            root.addView(titleView)

            val subView = TextView(this).apply {
                text = if (isSilenced) "Alarm silenced via button. Take action below:" else "Time to take action on your repeating task!"
                textSize = 15f
                setTextColor(Color.parseColor("#8F9BB3"))
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

            // 1. Mark Done Button (Golden Gradient with Dark Text)
            val doneBtn = Button(this).apply {
                text = "✓  MARK DONE"
                textSize = 16f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#121626"))
                background = GradientDrawable(
                    GradientDrawable.Orientation.TOP_BOTTOM,
                    intArrayOf(Color.parseColor("#FFBE4B"), Color.parseColor("#F29D26"))
                ).apply {
                    cornerRadius = dp(26).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(56)
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

            // 2. Snooze 10 Minutes Button (Dark with Gold outline)
            val snoozeBtn = Button(this).apply {
                text = "⏱  SNOOZE 10 MIN"
                textSize = 15f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#FFFFFF"))
                background = GradientDrawable().apply {
                    cornerRadius = dp(26).toFloat()
                    setColor(Color.parseColor("#10162A"))
                    setStroke(dp(1.5f), Color.parseColor("#F5B74F"))
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(54)
                ).apply {
                    bottomMargin = dp(16)
                }
                setOnClickListener {
                    autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
                    stopAlarm()
                    NotificationManagerCompat.from(this@AlarmActivity).cancel(singleItem.notificationId)
                    val snoozeTime = System.currentTimeMillis() + (10L * 60 * 1000)
                    AlarmReceiver.schedule(this@AlarmActivity, singleItem.taskId, singleItem.title, snoozeTime)
                    AlarmModule.recordAction(this@AlarmActivity, "SNOOZE_10M", singleItem.taskId)
                    bringAppToForeground("SNOOZE_10M", singleItem.taskId)
                    activeAlarms.clear()
                    finishAndRemoveTask()
                }
            }
            actionsContainer.addView(snoozeBtn)

            // 3. Dismiss Button
            val dismissBtn = TextView(this).apply {
                text = "Dismiss"
                textSize = 14f
                setTextColor(Color.parseColor("#758296"))
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

        rootFrame.addView(rootScroll)
        setContentView(rootFrame)
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    private fun dp(value: Float): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            resources.displayMetrics
        ).toInt()
    }

    override fun onDestroy() {
        autoSnoozeHandler.removeCallbacks(autoSnoozeRunnable)
        stopAlarm()
        unregisterScreenOffReceiver()
        super.onDestroy()
    }
}
