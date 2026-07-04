import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function initFirebase(): boolean {
  if (!isFirebaseConfigured()) return false;
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return true;
}

export function getFirebaseAuth(): Auth | null {
  if (!auth && isFirebaseConfigured()) initFirebase();
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  if (!db && isFirebaseConfigured()) initFirebase();
  return db;
}
