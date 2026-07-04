export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyAKMBxEVfd0w25iw2nL6rNEsG-yp0q3eu4',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'repeato-1c216.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'repeato-1c216',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'repeato-1c216.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '706229177036',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:706229177036:android:8e7fa490e8b2f3640d9069',
};

export const googleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '706229177036-859mh57hf1htu1apnus349tjib4biu88.apps.googleusercontent.com';

export const isFirebaseConfigured = (): boolean =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && !firebaseConfig.apiKey.includes('YOUR_'));
