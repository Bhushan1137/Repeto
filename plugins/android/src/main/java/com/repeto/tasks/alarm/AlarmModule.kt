package com.repeto.tasks.alarm

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        const val NAME = "AlarmModule"
        const val TAG = "AlarmModule"
        private const val PREFS_NAME = "repeato_alarm_actions_queue"
        private const val KEY_ACTIONS = "pending_actions"
        private var instance: AlarmModule? = null

        fun notifyTrigger(taskId: String, title: String) {
            instance?.let { mod ->
                try {
                    val map = Arguments.createMap().apply {
                        putString("taskId", taskId)
                        putString("title", title)
                    }
                    mod.reactApplicationContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onAlarmTriggered", map)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to emit onAlarmTriggered: ${e.message}")
                }
            }
        }

        fun notifyAction(action: String, taskId: String) {
            instance?.let { mod ->
                try {
                    val map = Arguments.createMap().apply {
                        putString("action", action)
                        putString("taskId", taskId)
                    }
                    mod.reactApplicationContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onAlarmAction", map)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to emit onAlarmAction: ${e.message}")
                }
            }
        }

        /**
         * Persistently records an alarm action into SharedPreferences so that
         * actions triggered while React Native is backgrounded, suspended, or cold-started
         * are never lost when multiple tasks/alarms are handled.
         */
        fun recordAction(context: Context, action: String, taskId: String) {
            if (taskId.isEmpty()) return
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val existing = prefs.getString(KEY_ACTIONS, "[]") ?: "[]"
                val jsonArray = JSONArray(existing)
                val item = JSONObject().apply {
                    put("action", action)
                    put("taskId", taskId)
                    put("timestamp", System.currentTimeMillis())
                }
                jsonArray.put(item)
                prefs.edit().putString(KEY_ACTIONS, jsonArray.toString()).apply()
                Log.d(TAG, "Recorded pending alarm action: $action for $taskId (queue size: ${jsonArray.length()})")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to record pending alarm action: ${e.message}", e)
            }

            // Also emit via DeviceEventEmitter in case React Native is already active in foreground
            notifyAction(action, taskId)
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun scheduleAlarm(taskId: String, title: String, triggerAtMillis: Double, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (alarmManager == null) {
                promise.reject("ALARM_ERROR", "AlarmManager not available")
                return
            }

            val triggerTime = triggerAtMillis.toLong()
            AlarmReceiver.schedule(context, taskId, title, triggerTime)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAlarm(taskId: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            AlarmReceiver.cancel(context, taskId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAllAlarms(promise: Promise) {
        try {
            NotificationManagerCompat.from(reactApplicationContext).cancelAll()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun triggerTestAlarm(seconds: Int, title: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val delayMs = (if (seconds <= 0) 2 else seconds) * 1000L
            val triggerTime = System.currentTimeMillis() + delayMs
            val testTaskId = "test-" + System.currentTimeMillis()
            AlarmReceiver.schedule(context, testTaskId, title, triggerTime)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getPendingAlarmActions(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonStr = prefs.getString(KEY_ACTIONS, "[]") ?: "[]"
            val jsonArray = JSONArray(jsonStr)

            val array = Arguments.createArray()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val map = Arguments.createMap().apply {
                    putString("action", obj.optString("action"))
                    putString("taskId", obj.optString("taskId"))
                }
                array.pushMap(map)
            }

            // Clear the drained actions
            prefs.edit().remove(KEY_ACTIONS).apply()
            Log.d(TAG, "Drained ${array.size()} pending alarm actions")

            // Also clean legacy intent extras so getInitialAlarmAction doesn't re-trigger
            reactApplicationContext.currentActivity?.intent?.let { intent ->
                intent.removeExtra("alarmAction")
                intent.removeExtra("taskId")
            }

            promise.resolve(array)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get pending alarm actions: ${e.message}", e)
            promise.resolve(Arguments.createArray())
        }
    }

    @ReactMethod
    fun getInitialAlarmAction(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            val intent = activity?.intent
            val action = intent?.getStringExtra("alarmAction")
            val taskId = intent?.getStringExtra("taskId")

            if (action != null && taskId != null) {
                val map = Arguments.createMap().apply {
                    putString("action", action)
                    putString("taskId", taskId)
                }
                intent.removeExtra("alarmAction")
                intent.removeExtra("taskId")
                promise.resolve(map)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN built-in Event Emitter Calls
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN built-in Event Emitter Calls
    }
}
