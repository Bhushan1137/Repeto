# Repeato

India-native recurring task app built with **React Native (Expo)** and **Firebase**.

## Quick start

```bash
cd repeato-app
npm install
npm start
```

For **Android production builds**, use a development build (Google Sign-In requires native code):

```bash
npx expo prebuild
npx expo run:android
```

## Firebase setup

1. Enable **Google Sign-In** in [Firebase Console](https://console.firebase.google.com) → Authentication → Sign-in method.
2. Add your **Android SHA-1** fingerprint (from `./gradlew signingReport` or EAS credentials) to the Firebase Android app.
3. **Deploy Firestore rules** (required — without this you get “Missing or insufficient permissions”):

```bash
npm install -g firebase-tools
firebase login
cd repeato-app
firebase deploy --only firestore:rules
```

Or paste the contents of `firestore.rules` manually in Firebase Console → Firestore → Rules → Publish.

4. Copy `.env.example` → `.env` (pre-filled values match `google-services.json` in this repo).

## Onboarding flow

1. Language → 2. Google Sign-In → 3. Profile (name + optional phone) → 4. Categories → 5. Presets → 6. Push notifications

## Architecture

```
app/                          # Expo Router screens
src/
├── domain/                   # Pure business logic
├── data/repositories/        # Firestore + local cache
├── services/firebase/        # Auth, Firestore, config
├── providers/                # Auth, Task, Toast
├── components/               # UI
└── hooks/                    # Feature hooks
```

## Data

- **Auth:** Google Sign-In → Firebase Auth
- **Storage:** Firestore (`users/{uid}`, `users/{uid}/tasks/{taskId}`)
- **Offline:** AsyncStorage cache + sync queue on failed writes

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Expo dev server |
| `npm run android` | Run on Android |
| `npm test` | Unit tests |
