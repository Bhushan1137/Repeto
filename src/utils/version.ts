import Constants from 'expo-constants';

/**
 * Dynamically resolves the app release version and build number.
 * Pulls directly from Expo configuration and runtime metadata.
 */
export const APP_VERSION: string =
  Constants.expoConfig?.version ??
  Constants.manifest2?.extra?.expoClient?.version ??
  '1.0.0';

export const BUILD_NUMBER: string | number =
  Constants.expoConfig?.android?.versionCode ??
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.nativeBuildVersion ??
  1;

/**
 * Returns formatted version tag for display, e.g.:
 * English: "Repeato v1.0.0 • Built with care"
 * Hindi: "Repeato v1.0.0 • प्यार से बनाया गया"
 */
export function getAppVersionLabel(language: 'en' | 'hi' = 'en'): string {
  if (language === 'hi') {
    return `Repeato v${APP_VERSION} • प्यार से बनाया गया`;
  }
  return `Repeato v${APP_VERSION} • Built with care`;
}
