const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');

const ALARM_PERMISSIONS = [
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.POST_NOTIFICATIONS',
];

function withAlarmPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    for (const permission of ALARM_PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (item) => item.$['android:name'] === permission
      );
      if (!exists) {
        manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    }
    return config;
  });
}

function withAlarmActivities(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (!mainApplication) return config;

    if (!mainApplication.activity) {
      mainApplication.activity = [];
    }

    const activityName = 'com.repeto.tasks.alarm.AlarmActivity';
    const existsActivity = mainApplication.activity.some(
      (a) => a.$['android:name'] === activityName
    );

    if (!existsActivity) {
      mainApplication.activity.push({
        $: {
          'android:name': activityName,
          'android:exported': 'true',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:showOnLockScreen': 'true',
          'android:excludeFromRecents': 'true',
          'android:launchMode': 'singleTask',
          'android:theme': '@android:style/Theme.Material.NoActionBar.Fullscreen',
        },
      });
    }

    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const receiverName = 'com.repeto.tasks.alarm.AlarmReceiver';
    const existsReceiver = mainApplication.receiver.some(
      (r) => r.$['android:name'] === receiverName
    );

    if (!existsReceiver) {
      mainApplication.receiver.push({
        $: {
          'android:name': receiverName,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'com.repeto.tasks.ALARM_TRIGGER' } },
              { $: { 'android:name': 'com.repeto.tasks.ALARM_ACTION_DONE' } },
              { $: { 'android:name': 'com.repeto.tasks.ALARM_ACTION_SNOOZE' } },
              { $: { 'android:name': 'com.repeto.tasks.ALARM_DISMISS' } },
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            ],
          },
        ],
      });
    }

    return config;
  });
}

function withAlarmFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = config.modRequest.platformProjectRoot;

      // 1. Copy alarm_chime.wav to res/raw
      const rawDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'raw');
      if (!fs.existsSync(rawDir)) {
        fs.mkdirSync(rawDir, { recursive: true });
      }

      const sourceChime = path.join(projectRoot, 'assets', 'sounds', 'alarm_chime.wav');
      if (fs.existsSync(sourceChime)) {
        fs.copyFileSync(sourceChime, path.join(rawDir, 'alarm_chime.wav'));
      }

      // 2. Copy Kotlin native source files
      const targetAlarmDir = path.join(
        androidRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'repeto',
        'tasks',
        'alarm'
      );
      if (!fs.existsSync(targetAlarmDir)) {
        fs.mkdirSync(targetAlarmDir, { recursive: true });
      }

      const sourceAlarmDir = path.join(
        projectRoot,
        'plugins',
        'android',
        'src',
        'main',
        'java',
        'com',
        'repeto',
        'tasks',
        'alarm'
      );

      const kotlinFiles = ['AlarmReceiver.kt', 'AlarmActivity.kt', 'AlarmModule.kt', 'AlarmPackage.kt'];
      for (const file of kotlinFiles) {
        const srcFile = path.join(sourceAlarmDir, file);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, path.join(targetAlarmDir, file));
        }
      }

      return config;
    },
  ]);
}

function withAlarmPackageInMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('AlarmPackage')) {
      // 1. Add import
      const importStatement = 'import com.repeto.tasks.alarm.AlarmPackage\n';
      const packageIndex = contents.indexOf('package ');
      if (packageIndex !== -1) {
        const lineEnd = contents.indexOf('\n', packageIndex);
        contents = contents.slice(0, lineEnd + 1) + '\n' + importStatement + contents.slice(lineEnd + 1);
      }

      // 2. Add Package to getPackages()
      if (contents.includes('PackageList(this).packages.apply {')) {
        contents = contents.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n              add(AlarmPackage())'
        );
      } else if (contents.includes('PackageList(this).packages')) {
        contents = contents.replace(
          'PackageList(this).packages',
          'PackageList(this).packages.apply {\n              add(AlarmPackage())\n            }'
        );
      }

      config.modResults.contents = contents;
    }

    return config;
  });
}

function withAlarm(config) {
  config = withAlarmPermissions(config);
  config = withAlarmActivities(config);
  config = withAlarmFiles(config);
  config = withAlarmPackageInMainApplication(config);
  return config;
}

module.exports = createRunOncePlugin(withAlarm, 'withAlarm', pkg.version);
