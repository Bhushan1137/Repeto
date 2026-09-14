# Repeto: Google Play Store Release Master Guide

This guide details every step required to take **Repeto** (`com.repeto.tasks`) from initial setup in the Google Play Console to your first live production release.

---

## 1. Quick Reference & Key Identifiers

| Item | Value |
|---|---|
| **App Name** | `Repeto: Routines & Reminders` *(max 30 chars)* |
| **Package Name** | `com.repeto.tasks` |
| **EAS Project ID** | `dc3bf5ae-77fe-4235-83b7-47a896e72430` |
| **Firebase Project** | `repeto-ff21c` |
| **Privacy Policy URL** | `https://repeto.online/privacy.html` |
| **Terms of Service URL** | `https://repeto.online/terms.html` |
| **Account Deletion URL** | `https://repeto.online/account-deletion.html` |
| **Support Email** | Your support email (e.g. `support@repeto.online` or your personal contact) |

---

## 2. Initial App Creation in Google Play Console

1. Log in to [Google Play Console](https://play.google.com/console).
2. Click **Create app** (top-right).
3. Fill in the basics:
   - **App name**: `Repeto: Routines & Reminders`
   - **Default language**: `English (United States)` (or your preferred base language)
   - **App or game**: `App`
   - **Free or paid**: `Free`
4. Accept the **Developer Program Policies** and **US export laws** checkboxes.
5. Click **Create app**.

---

## 3. Store Presence (Main Store Listing)

Navigate to **Grow → Store presence → Main store listing**.

### A. Listing Details
- **App name** *(max 30 chars)*:  
  `Repeto: Routines & Reminders`
- **Short description** *(max 80 chars)*:  
  `Never forget what repeats. Recurring bills, routines & shared household tasks.`
- **Full description** *(max 4000 chars)*:
  ```text
  Repeto is your personal routine and bill reminder assistant, designed to ensure you never forget what repeats.

  KEY FEATURES:
  • Routines & Habits: Never miss daily medicines, monthly rent, EMIs, water bills, or vehicle insurance renewals.
  • Smart Recurrence: Set up flexible recurring schedules (daily, weekly, monthly, annual, or custom intervals).
  • Shared Households: Invite family members or flatmates with a quick QR code to share chores and split bill tracking.
  • Offline First: Complete routines even without internet access. Repeto automatically syncs when you reconnect.
  • Natural & Clean: A distraction-free interface built to keep your daily routines calm and organized.
  • Privacy First: Safe Google Sign-In authentication with full control to manage and delete your data anytime.

  Simplify your repeating life with Repeto!
  ```

### B. Graphic Assets

1. **App Icon**:
   - Specifications: `512 × 512 px`, 32-bit PNG with alpha, max 1 MB.
   - Asset: Use `assets/images/app-icon.png` resized to 512×512.
2. **Feature Graphic**:
   - Specifications: `1024 × 500 px`, JPG or 24-bit PNG (no alpha), max 1 MB.
   - Design: Brand background (`#171B36` or `#FBF7EF`) featuring the Repeto logo emblem and the tagline *"Never forget what repeats"*.
3. **Phone Screenshots**:
   - Minimum 2, recommended **4 to 6** high-resolution screenshots.
   - Specifications: `1080 × 2400 px` (or standard 9:16 portrait ratio).
   - Recommended screens to capture:
     1. **Home Screen**: Showing overdue, today, and upcoming routine cards.
     2. **Add / Edit Routine**: Showing the recurrence picker, category icons, and natural scheduling.
     3. **Shared Household**: Showing household members, shared chores, and QR invite code.
     4. **Insights / Calendar**: Showing routine completion trends and monthly calendar view.
4. **Tablet Screenshots (Optional)**:
   - Not required unless targeting 7-inch and 10-inch tablets as primary devices.

---

## 4. App Content & Policy Declarations (Mandatory)

Navigate to **Policy and programs → App content** (or the **Set up your app** checklist on the Dashboard). Complete every section as detailed below:

### 1. Privacy Policy
- **URL**: `https://repeto.online/privacy.html`
- Click **Save**.

### 2. App Access
- Choose: **All functionality is available without special access** (if reviewers can test freely with Google Sign-In)  
  *OR* choose **All or some functionality is restricted** and provide test instructions:
  - Explain: *"Users can sign in with any standard Google Account. Alternatively, use test credentials: [Email / Password if enabled]"*.

### 3. Ads
- Select: **No, my app does not contain ads**.

### 4. Content Rating (IARC Questionnaire)
- Click **Start questionnaire**.
- Enter your contact email.
- **Category**: Select **Utility, Productivity, Communication, or Other**.
- Answer the questions:
  - Violence: **No**
  - Sexuality: **No**
  - Offensive language: **No**
  - Controlled substances: **No**
  - Shares user location: **No**
  - Allows users to interact or exchange messages: **No** (Household sharing is task sync only, not a public chat)
- Click **Save** → **Next** → **Submit** (Generates rating: **Everyone / PEGI 3**).

### 5. Target Audience and Content
- **Target age groups**: Select **18 and over** (and/or **13–17**).
  > **Crucial**: Do **NOT** select age groups under 13. Selecting children triggers the strict "Designed for Families" and COPPA policy requirements.
- **Appeal to children**: Select **No**.

### 6. News Apps
- Select: **No, my app is not a news app**.

### 7. COVID-19 Contact Tracing and Status
- Select: **My app is not a publicly available COVID-19 contact tracing or status app**.

### 8. Data Safety
Fill in the questionnaire based on Repeto's architecture:
1. **Does your app collect or share any of the required user data types?** → **Yes**
2. **Is all user data collected encrypted in transit?** → **Yes** (HTTPS/TLS to Firebase)
3. **Do you provide a way for users to request that their data be deleted?** → **Yes**
   - Provide Account Deletion URL: `https://repeto.online/account-deletion.html`
   - In-app mechanism: Users can soft-delete or permanently purge their account directly in **Profile → Settings → Delete Account**.
4. **Data Types Collected**:
   - **Personal info**:
     - *Name*: App functionality, Account management.
     - *Email address*: Account management (Firebase Auth).
   - **App activity**:
     - *Other user-generated content / actions*: Routine and task titles, recurrences (Core app functionality).
   - **App info and performance**:
     - *Crash logs & Diagnostics*: Analytics & Bug fixing (if crashlytics/monitoring enabled).
5. **Data Sharing**:
   - Repeto does **not** sell or share data with third-party advertisers or data brokers.

### 9. Government Apps
- Select: **No, this app does not represent a government entity**.

### 10. Financial Features Declaration
- Google Play requires declaring any financial functionality.
- Select: **None of the above** *(or Personal finance management / budget tracker)*.
- Note: Declare that Repeto is a routine and bill reminder utility and does **not** issue loans, credit, banking, or cryptocurrency exchange services.

### 11. Exact Alarm Permission (`SCHEDULE_EXACT_ALARM`)
- Google Play reviews exact alarm permissions strictly on Android 14+.
- Under the declaration, select:
  - **Permissible use case**: **Alarms or timers** (or **Calendar / Reminder events**).
  - Rationale: *"Repeto's core feature is scheduling and triggering timely, exact reminders for critical routine events such as medicine schedules, utility bill due dates, and daily household chores."*

---

## 5. CRITICAL: Linking Google Play App Signing to Firebase

> [!WARNING]
> **This is the #1 reason Google Sign-In fails in production!**  
> When you upload an `.aab` to Google Play, Google strips your EAS upload key and re-signs the app with **Google's Play App Signing Key**. You must add Google's SHA-1 to Firebase.

1. In **Google Play Console**, go to **Release → Setup → App integrity**.
2. Under the **App signing** tab, locate:
   - **App signing key certificate**
   - Copy the **SHA-1 certificate fingerprint** (format: `AA:BB:CC:...`).
3. Open [Firebase Console](https://console.firebase.google.com/) → Select `repeto-ff21c`.
4. Go to **Project Settings** (gear icon) → **General**.
5. Scroll down to **Your apps → Android app (`com.repeto.tasks`)**.
6. Click **Add fingerprint** and paste the **SHA-1 fingerprint** from Google Play.
7. *(Optional but recommended)* Also copy and add the **SHA-256 fingerprint**.

---

## 6. Testing Strategy: Internal vs. Closed Testing

### Option A: Internal Testing (Fastest verification)
- **Path**: **Testing → Internal testing**.
- **Review time**: **None** (available within 10–15 minutes).
- **Steps**:
  1. Click **Create new release**.
  2. Upload the downloaded `.aab` file from your EAS build.
  3. Enter Release name (e.g. `1.0.0 (1)`).
  4. Under **Testers**, create an email list with your own email and invite yourself.
  5. Open the opt-in link on your Android phone, install via the Play Store, and verify:
     - Google Sign-In succeeds.
     - Firestore syncs tasks without permission errors.
     - Exact alarms trigger notifications.
     - Household QR invite scan works.

### Option B: Closed Testing (Personal Developer Accounts Requirement)
- **Note**: If your Google Play Developer Account is a **personal account created after November 13, 2023**, Google requires:
  - **20 testers opted-in for at least 14 consecutive days** before you can apply to publish to Production.
- **Steps**:
  1. Navigate to **Testing → Closed testing**.
  2. Create a track, upload your `.aab`, and invite at least 20 testers.
  3. Ensure testers remain enrolled and periodically open the app over the 14-day window.
  4. Once complete, click **Apply for production** on your dashboard.

---

## 7. Submitting to Production

Once verified on an internal or closed track:

1. In Play Console, go to **Release → Production**.
2. Click **Create new release**.
3. Under App bundles, click **Add from library** and select your verified `.aab` (or upload the file).
4. Enter Release notes:
   ```text
   Welcome to Repeto! Never forget what repeats.
   - Schedule recurring routines, bills, and household chores
   - Share chores and expenses with flatmates and family
   - Offline-first tracking with automatic sync
   ```
5. Click **Next** → Review summary warnings.
6. Click **Start rollout to Production**.

---

## 8. Review Timelines & Post-Release Checklist

- **Review Duration**: Initial app releases typically take **1 to 4 business days** to be reviewed by Google.
- **Check Status**: Monitor **Publishing overview** and your developer email for notifications.
- **Common Rejection Reasons & Preventions**:
  - *Broken Google Login*: Solved by adding Google Play Signing SHA-1 to Firebase (Section 5).
  - *Missing Privacy / Deletion Link*: Solved by active `https://repeto.online/privacy.html` and `account-deletion.html`.
  - *Exact Alarm Rejection*: Solved by selecting "Alarms or timers / routine reminder" in the permission declaration.
