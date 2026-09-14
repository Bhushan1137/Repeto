import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordReset,
  type User,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { Platform } from 'react-native';
import { getFirebaseAuth } from './app';
import { googleWebClientId } from './config';

let nativeGoogleConfigured = false;

export function configureGoogleSignIn(): void {
  // Handled lazily on native platforms before signing in
}

async function configureNativeGoogleSignIn(): Promise<void> {
  if (Platform.OS === 'web' || nativeGoogleConfigured) return;
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: googleWebClientId, offlineAccess: false });
  nativeGoogleConfigured = true;
}

export function subscribeToAuth(callback: (user: User | null) => void): (() => void) | null {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  return onAuthStateChanged(auth, callback);
}

/** Call once on web app load to complete redirect-based sign-in */
export async function completeGoogleRedirectSignIn(): Promise<User | null> {
  if (Platform.OS !== 'web') return null;
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch {
    return null;
  }
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

async function signInWithGoogleWeb(auth: NonNullable<ReturnType<typeof getFirebaseAuth>>): Promise<User> {
  const provider = googleProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    if (err instanceof FirebaseError) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
      }
      if (err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
        throw Object.assign(new Error('redirect_pending'), { code: 'redirect_pending' });
      }
    }
    throw err;
  }
}

async function signInWithGoogleAndroid(): Promise<User> {
  await configureNativeGoogleSignIn();
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('auth_unavailable');

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (response.type === 'cancelled') {
    throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
  }

  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('no_token');

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

export async function signInWithGoogleNative(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('auth_unavailable');

  if (Platform.OS === 'web') {
    return signInWithGoogleWeb(auth);
  }

  return signInWithGoogleAndroid();
}

// ---------------------------------------------------------------------------
// Email/Password authentication
// ---------------------------------------------------------------------------
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('auth_unavailable');
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmailPassword(
  email: string,
  password: string
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('auth_unavailable');
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

/** Send a password-reset email */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('auth_unavailable');
  await firebaseSendPasswordReset(auth, email);
}

export async function signOutFirebase(): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.signOut();
    } catch {
      // ignore
    }
  }
  const auth = getFirebaseAuth();
  if (auth) await firebaseSignOut(auth);
}

export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed':
      return 'Authentication service is currently unavailable. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please check the email or create an account.';
    case 'auth/wrong-password':
      return 'Incorrect password. Use "Forgot password?" to reset it.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'redirect_pending':
      return 'Redirecting to Google…';
    default:
      return 'Authentication failed. Please try again.';
  }
}
