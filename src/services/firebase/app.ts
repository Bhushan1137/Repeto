import { initializeApp, getApps, setLogLevel, type FirebaseApp } from 'firebase/app';
// @ts-expect-error getReactNativePersistence types differ across bundlers
import { initializeAuth, getReactNativePersistence, getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { firebaseConfig, isFirebaseConfigured } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function initFirebase(): boolean {
  if (!isFirebaseConfigured()) return false;
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    try {
      setLogLevel('silent');
    } catch {
      // Ignore if setLogLevel fails on platform
    }
  }
  if (!auth && app) {
    if (Platform.OS === 'web') {
      try {
        auth = getAuth(app);
      } catch {
        auth = initializeAuth(app);
      }
    } else {
      try {
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch {
        auth = getAuth(app);
      }
    }
  }
  if (!db && app) {
    db = getFirestore(app);
  }
  return Boolean(app && auth && db);
}

export function getFirebaseAuth(): Auth | null {
  if (!auth && isFirebaseConfigured()) initFirebase();
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  if (!db && isFirebaseConfigured()) initFirebase();
  return db;
}
