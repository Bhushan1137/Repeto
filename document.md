# Repeto: Comprehensive Marketing & Product Context Document

> **How to use this document with AI:**  
> Feed this document as a system prompt, context upload, or initial message to any AI (ChatGPT, Claude, Gemini, Perplexity) with instructions like:  
> *"Using this comprehensive product context about Repeto, generate [high-converting TikTok/Reels ad hooks / Google Ads copy / email onboarding sequence / Product Hunt launch copy / Reddit organic discussion strategy / App Store Optimization metadata]."*

---

## 1. Executive Summary & Product DNA

* **App Name:** Repeto (Package: `com.repeto.tasks`)
* **Tagline / One-Liner:** The intelligent recurring task and household routine manager that never lets life's repeating commitments slip through the cracks.
* **Category:** Productivity / Family & Household Organizers / Habit & Routine Trackers
* **Platform:** Android (Cross-platform Expo/React Native foundation, native Kotlin alarm system, SQLite + Firebase cloud architecture)
* **Aesthetic & Brand Feel:** Premium Midnight & Warm Amber/Gold (`#0D1322` deep night, `#FFBE4B` → `#F29D26` golden glow). Clean, tactile, calming, respectful—free of visual noise or generic corporate sterility.
* **Core Philosophy:** *Life doesn't happen in one-off to-do lists. Life repeats.* Generic to-do apps force users to constantly re-type, re-schedule, and micro-manage. Repeto turns recurring mental clutter into a predictable, automated, shared rhythm.

---

## 2. The Problem Repeto Solves

### The "Recurring Task Friction" Problem
Traditional productivity tools (Todoist, Google Tasks, Apple Reminders, Notion) are architected for **linear, one-off projects** (e.g., "Finish presentation slides"). When users try to manage repeating life routines with them:
1. **Notification Blindness:** Passive banner notifications are easily dismissed or lost in a barrage of 50 daily app notifications.
2. **Setup Exhaustion:** Configuring repeating frequencies, custom cadences, and finance tags in standard apps takes 6 to 8 tedious clicks per task.
3. **Household Friction & Mental Load:** In shared households, couples or roommates argue over chores because "who did what last" is undocumented, leading to passive-aggressive nagging or uneven invisible labor.
4. **Financial Oversight:** Recurring utility bills, subscriptions, maid/cook salaries, milk cards, and EMIs are scattered across banking apps, calendar alerts, and mental notes, leading to late fees or missed renewal deadlines.
5. **The Do-Not-Disturb / Closed-App Black Hole:** Standard mobile notifications fail to alert users when a task is urgent and their device is locked or in deep sleep.

---

## 3. Core Features & Technical Highlights

### 3.1. Natural Language Task Creator ("Type Like You Speak")
* **What it does:** Users simply type a natural sentence—e.g., *"Pay rent 18000 every 5th of month"* or *"Water plants every 3 days"* or *"Ironing bill 350 every week"*.
* **Behind the scenes:** Repeto's smart parser automatically extracts:
  * **Title:** Cleaned task name.
  * **Frequency / Cadence:** Exact interval (daily, every X days, weekly on specific days, monthly on Nth day, annual, etc.).
  * **Amount (₹ / Currency):** Automatically detects monetary values and tags the task as a Financial commitment.
  * **Category:** Intelligently maps to one of 14 preset domains.

### 3.2. Native Full-Screen Wake-up Alarm System
* **Why it blows away competitors:** Most task apps only trigger a quiet, dismissible banner. Repeto features a **native Android alarm engine** (`AlarmActivity.kt`, `AlarmReceiver.kt`):
  * **RTC Hardware Alarm:** Registered directly in Android's system `AlarmManager` (`RTC_WAKEUP`). Fires on time even if the app is killed or device is asleep.
  * **Full-Screen Lock Bypass (`USE_FULL_SCREEN_INTENT`):** Turns the phone screen ON and displays the high-contrast midnight & gold alarm window right over the lock screen without unlocking the phone.
  * **Urgent Alarm Chime:** Plays via Android `MediaPlayer` on `AudioAttributes.USAGE_ALARM` with pulsing haptic vibration.
  * **One-Tap Actions:** Immediate **"Mark Done"** or **"Snooze 10 Min"** directly on screen.
  * **Auto-Snooze & Missed Tracking:** If ignored for 1 minute, auto-snoozes for 15 minutes; if missed again, flags as "Missed Reminder" in notification center.

### 3.3. Collaborative Household & Chore Sharing
* **Shared Ecosystem:** Create a household and invite family, partners, or roommates via a 6-digit code or QR code.
* **Three Flexible Responsibility Models:**
  1. **Just Me (Personal):** Private to the creator.
  2. **Open to All:** Visible to all household members; whoever gets to it first taps "Mark Done".
  3. **Assign to Member:** Specifically delegated to a designated person.
  4. **Rotate Turns 🔄 (Automated Fairness):** Automatically rotates to the next household member sequentially upon completion (e.g., Dishwashing rotates: Alice ➔ Bob ➔ Charlie ➔ Alice). Eliminates chore choreographing arguments!

### 3.4. Recurring Finance & Expense Explorer
* Tag tasks with financial values (Rent, EMIs, Maid salary, Subscriptions, Gas refill, Society maintenance).
* **Finance Explorer:** Summarizes projected monthly cash outlays, breakdown by category, and shows exactly what is coming due this week/month.

### 3.5. Curated Presets Library (Culturally Rich & Universal)
Pre-configured with dozens of tailored templates across 14 life categories:
* **Bills & Utilities:** Rent, Credit Card, Electricity, Water, Gas Cylinder Refill, Internet, Mobile Recharge (28-day cycle), EMIs.
* **Household Help:** Maid, Cook, Driver, Laundry/Dhobi, Society Maintenance.
* **Subscriptions:** Netflix, Spotify, Amazon Prime, YouTube, Cloud Storage, Gym.
* **Health & Medical:** Daily medicines, Vitamin supplements, 30-day refills, 6-month dental/eye checkups.
* **Vehicle Care:** Fuel refills, Vehicle service, PUC renewal (6 months), Bike/Car Insurance (annual), Tyre checks.
* **Home Maintenance:** AC service & filter clean, RO water purifier service, Pest control.
* **Daily Supplies:** Daily milk delivery bill, 20L water can delivery (every 3 days), Grocery restock.
* **Personal & Family:** Haircut/Salon, Kid school fees, Pet feeding & vet vaccinations, Festival prep.

### 3.6. Offline-First Architecture & Dual Language
* Built with an offline-first SQLite database that synchronizes seamlessly with Firebase Cloud Firestore. Works perfectly in basements, flights, or spotty networks.
* **Full Bilingual Support:** Native English and Hindi (`en` / `hi`), localized down to frequency phrases and preset templates.

---

## 4. Target Customer Personas

### Persona A: "The Household Anchor" (Couples, Working Parents)
* **Demographics:** Age 28–45, married or living with partner, running a home with multiple responsibilities.
* **Pain Points:** 
  * "I carry the entire mental load of the house—remembering when the RO filter needs changing, when the maid's salary is due, and when the kid's school fees hit."
  * Nagging their partner creates relationship friction; chores are forgotten or duplicated.
* **Repeto Hook:** *"Stop being the household reminder bot. Let Repeto automate chore rotation, split responsibilities, and send the alarms."*

### Persona B: "The Independent Urban Professional" (Living Solo or with Roommates)
* **Demographics:** Age 22–34, renting in metro cities, managing apartment with flatmates or solo.
* **Pain Points:** 
  * Forgotten 28-day mobile recharges, missed credit card due dates, expired vehicle PUCs, dirty AC filters, running out of drinking water cans.
  * Flatmate chore drama: "Who cleaned the bathroom last?"
* **Repeto Hook:** *"Adulting on autopilot. Manage flatmate chore turns without a single passive-aggressive WhatsApp message."*

### Persona C: "The ADHD / Time-Blind High Achiever"
* **Demographics:** Students, freelancers, creatives, and neurodivergent individuals who struggle with routine maintenance.
* **Pain Points:** 
  * "If a task doesn't pop up in front of my face right now, it ceases to exist."
  * Standard notification banners get swiped away and instantly forgotten.
  * Routine fatigue: starting habits is easy; sustaining repeating mundane tasks is overwhelming.
* **Repeto Hook:** *"The only routine tracker with alarms that wake your screen over the lock screen. Never lose a habit to notification blindness again."*

### Persona D: "The Family Caregiver / Adult Child"
* **Demographics:** Age 30–50, managing their parents' health and supplies from another city or under the same roof.
* **Pain Points:** 
  * Remembering elderly parents' monthly medicine refills, BP check-ups, and utility bill deadlines.
* **Repeto Hook:** *"Take care of your parents' recurring medicines and home bills with shared household alerts, even from miles away."*

---

## 5. Competitive Positioning & Value Matrix

| Capability / Feature | Generic To-Do Apps (Todoist, Google Tasks) | Standard Habit Trackers (Streaks, Habitica) | WhatsApp Groups / Splitwise | **Repeto** |
| :--- | :--- | :--- | :--- | :--- |
| **Recurring Task Focus** | Secondary (built for linear 1-off tasks) | Daily habits only (can't handle complex bill schedules) | None (informal chatting) | **Core Purpose (Daily to Annual rules)** |
| **Natural Language Input** | Partial / Paid tier | Rare | None | **Native & Instant with amounts & cadences** |
| **Screen-Waking Full Alarm** | ❌ (Passive banners only) | ❌ (Passive banners only) | ❌ (Standard notification) | **✅ Native Full-Screen Lockscreen UI + Alarm** |
| **Automatic Turn Rotation 🔄** | ❌ (Manual re-assignment) | ❌ (Single-user only) | ❌ (Requires manual tracking) | **✅ Automated Member Rotation on completion** |
| **Expense & Bill Linkage** | ❌ (No monetary tracking) | ❌ | Partial (only expense splitting, no task alarms) | **✅ Built-in Recurring Finance Explorer** |
| **Household Sharing** | Requires paid team plan | ❌ Single user | Messy chat threads | **✅ Seamless 6-digit code or QR code invite** |
| **Offline-First** | Cloud-dependent sync lag | Varies | Cloud-dependent | **✅ Instant local SQLite + cloud sync** |

---

## 6. Brand Voice, Tone & Messaging Pillars

### Tone of Voice:
* **Calm & Reassuring:** Never preachy, frantic, or shame-inducing when a task is overdue.
* **Practical & Grounded:** Speaks in real-life terms ("water can delivery", "maid salary", "haircut", "rent") rather than vague corporate jargon like "deliverables" or "synergy".
* **Dignified & Sharp:** The aesthetic is midnight and warm amber—resembling an elegant analog timepiece or luxury dashboard.

### Core Messaging Pillars:
1. **Zero Mental Load:** Your brain is for having ideas, not remembering that your car PUC expires on the 14th.
2. **Fair & Frictionless Living:** Harmony in the home comes from transparent, automated systems—not nagging.
3. **Unmissable Reliability:** When something truly matters, a subtle push banner isn't enough; you need an alarm that wakes your screen.

---

## 7. High-Converting Marketing Angles & Angles for Social Content

### Angle 1: "The Mental Load / Invisible Labor of Relationships"
* **Hook:** *"The real reason couples fight about chores isn't laziness—it's mental load."*
* **Narrative:** One person has to remember everything (milk, cleaner, grocery day, laundry), turning them into a nagging manager. Show how Repeto's **"Rotate Turns 🔄"** feature makes chore distribution completely neutral and automatic.

### Angle 2: "Notification Blindness vs. Full-Screen Alarms"
* **Hook:** *"Why standard to-do list apps fail for people with ADHD or busy lives."*
* **Visual / Script:** Show someone swiping away 12 notifications on their lock screen without reading them. Then cut to Repeto's **Midnight-Gold Full-Screen Alarm** popping up when the phone is locked, ringing the chime with instant "Mark Done" or "Snooze 10m".
* **Tagline:** *"A reminder that actually wakes your screen."*

### Angle 3: "Adulting on Autopilot (The Recurring Bill Trap)"
* **Hook:** *"You didn't overspend this month; you just forgot 5 recurring payments were due."*
* **Narrative:** Break down the chaotic mess of 28-day recharges, quarterly society maintenance, annual car insurance, and subscriptions. Show how Repeto's natural language parser (*"WiFi bill 999 every month"*) builds a recurring expense dashboard in 30 seconds.

### Angle 4: "Flatmate Harmony / The Roommate Cure"
* **Hook:** *"How we stopped arguing over whose turn it was to clean the kitchen / buy the water jar."*
* **Format:** POV video or meme showing flatmates pointing fingers vs. showing Repeto rotating the chore turn automatically.

---

## 8. Growth Channels & Tactical Playbook

### 1. Organic Short-Form Video (TikTok / Instagram Reels / YouTube Shorts)
* **Format:** Split-screen POVs, "Apps that feel illegal to know", "How to automate your home life in 2026", "ADHD-friendly systems that actually work".
* **Demonstrations:** Show typing *"Maid salary 3500 every 1st"* and watching Repeto parse it into a recurring card with alarm in 2 seconds.

### 2. Reddit Community Outreach (Authentic & Value-First)
* **Target Subreddits:** `r/ADHD`, `r/productivity`, `r/livingalone`, `r/roommates`, `r/TwoXChromosomes` (mental load discussions), `r/bangalore` / `r/india` / `r/delhi` (domestic help & urban apartment management).
* **Strategy:** Share the story of why passive notifications failed and how building an offline-first app with full-screen alarms and turn-rotation solved roommate/household chores.

### 3. App Store Optimization (ASO) Keyword Targets
* **Primary Keywords:** Recurring task tracker, household chores app, recurring reminder alarm, chore rotation, repeat task manager, bill reminder app.
* **Secondary / Long-tail:** Roommate chore wheel, ADHD alarm reminder, full screen task alarm, maid salary tracker, offline repeating reminder.

---

## 9. AI Marketing Prompts You Can Run With This Document

Copy any of the prompts below into your AI chat alongside this document:

* **Prompt 1 (TikTok/Reels UGC Hooks):**  
  *"Using the Repeto context document, generate 10 viral video concepts with hook, visual storyboard, and CTA targeting young couples moving in together."*
* **Prompt 2 (Google Ads & Search Copy):**  
  *"Generate 5 high-intent Google Search Ad groups (Headlines, Descriptions, Keywords) targeting people searching for chore apps and recurring bill reminders."*
* **Prompt 3 (Product Hunt Launch Copy):**  
  *"Draft a complete Product Hunt launch page: Tagline, Maker's comment, 5 key feature bullets, and anticipated FAQ response."*
* **Prompt 4 (Influencer Outreach Pitch):**  
  *"Write a personalized, non-spammy outreach email pitch to productivity and lifestyle content creators explaining why their audience needs Repeto."*
* **Prompt 5 (Email Onboarding Sequence):**  
  *"Write a 4-part onboarding email sequence for new Repeto users: Day 1 (Setting your first repeating task), Day 3 (Inviting a household member), Day 5 (The power of full-screen alarms), Day 7 (Reviewing your first week of insights)."*
