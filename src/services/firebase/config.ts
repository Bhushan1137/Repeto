export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyBOi8GOqP-IXOBG-ql-FO9k9pnwVS4_Bwo',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'repeto-ff21c.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'repeto-ff21c',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'repeto-ff21c.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '190445167944',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:190445167944:android:6e1fc96fee9634b294bf7d',
};

export const googleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '190445167944-6nihi0ga32ctvitp3o36e4kv5lhuosss.apps.googleusercontent.com';

export const isFirebaseConfigured = (): boolean =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && !firebaseConfig.apiKey.includes('YOUR_'));
