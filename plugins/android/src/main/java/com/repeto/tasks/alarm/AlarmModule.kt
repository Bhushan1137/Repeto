package com.repeto.tasks.alarm

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        const val NAME = "AlarmModule"
        const val TAG = "AlarmModule"
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
    fun getInitialAlarmAction(promise: Promise) {
        try {
            val currentActivity = currentActivity
            val intent = currentActivity?.intent
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
