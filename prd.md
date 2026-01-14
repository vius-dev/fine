# ImFine — MVP Product Document

## 1. Product Overview

**Product name:** ImFine  
**Purpose:**  
A low-friction personal safety app that allows users to periodically confirm they are fine. If the user fails to confirm within a defined time window, the system notifies trusted contacts.

**Target users:**

* People living alone
* Remote workers
* Elderly users with smartphones
* Individuals with health or safety concerns (non-emergency)

**Non-goals (explicit):**

* Not an emergency response service
* Not a medical monitoring app
* No real-time tracking

---

## 2. Core Product Principles

1. **Reliability over features**
2. **Minimum cognitive load**
3. **Backend is the source of truth**
4. **False negatives are worse than false positives**
5. **Explicit consent and transparency**

---

## 3. MVP Scope (Strict)

### Included

* Manual check-in ("I'm fine")
* Configurable check-in interval
* Grace period
* Trusted contacts
* Escalation notification
* Basic verification (soft + optional biometric)
* **Emergency ringtone for escalated scenarios**

### Excluded (v1)

* GPS tracking
* Wearables
* AI detection
* Social features
* Streaks / gamification

---

## 4. User Flow (End-to-End)

### 4.1 Onboarding

1. Welcome screen
2. Value explanation (1 screen)
3. Create account (email)
4. Set check-in interval (default: 24h)
5. Set grace period (default: 12h)
6. Add at least one trusted contact
7. Notification permissions
8. **Audio permissions (for escalation ringtone)**
9. Optional: Set verification settings (user chooses to enable)
10. Done

---

### 4.2 Daily Check-in Flow

1. Push notification reminder
2. App opens to **single primary action**
3. User taps **"I'm fine"**
4. Verification step (Enter verification code if enabled)
5. Confirmation feedback
6. Backend timestamp updated

---

### 4.3 Missed Check-in Flow

1. Backend detects overdue user
2. Grace period starts
3. Reminder notification sent
4. Grace period expires
5. Escalation triggered
6. **Loud ringtone plays on user's device (if app is installed and audio permissions granted)**
7. Trusted contacts notified

---

### 4.4 Escalation Ringtone Behavior

**Trigger conditions:**
* User state transitions to ESCALATED
* App receives escalation push notification
* Audio permissions granted

**Ringtone behavior:**
* Plays at maximum device volume (bypasses silent/vibrate if permitted by OS)
* Loops continuously for up to 5 minutes or until dismissed
* Displays full-screen alert with large "I'm Fine" button
* If dismissed without check-in, snoozes for 15 minutes and repeats
* Only stops when user completes check-in or 3 cycles complete

**User control:**
* Can be disabled in settings (not recommended during onboarding)
* Volume level configurable (default: max)
* Can choose different ringtone from preset options
* Clear explanation: "This helps your contacts reach you in emergencies"

---

## 5. MVP UI / UX Specification

### 5.1 Design Tone

* Calm
* Neutral
* Non-alarming (except escalation state)
* High contrast
* Large tap targets

---

### 5.2 Primary Screens

#### Home / Check-in Screen

**Elements:**

* Status text: "Last confirmed: Today at 09:14"
* Large primary button: **I'm fine**
* Secondary text: "Next check-in in 18h"

**Rules:**

* No secondary CTAs
* Button always visible

---

#### Confirmation Screen

* Text: "You're confirmed."
* Timestamp
* Subtle success feedback

Auto-dismiss after 2 seconds.

---

#### Escalation Alert Screen (New)

**Full-screen takeover when escalated:**

* Red/orange background (attention-grabbing but not panic-inducing)
* Large text: "Check-in Missed"
* Subtext: "Your contacts have been notified. Are you okay?"
* Large primary button: **"I'm Fine"**
* Secondary button: "Snooze 15 min" (smaller, less prominent)
* Ringtone plays continuously
* Screen stays on (prevents lock)

**Behavior:**
* Appears over lock screen if possible (OS permitting)
* Dismissing without action = ringtone returns in 15 minutes
* Tapping "I'm Fine" = normal check-in flow + stops ringtone

---

#### Verification Modal (Optional)

Triggered only when required.

Options:

* Long press confirmation
* Biometric prompt

No typing by default.

---

#### Contacts Screen

* List of trusted contacts
* Status: confirmed / pending consent
* Add / remove contact

---

#### Settings Screen

* Check-in interval
* Grace period
* Verification level
* **Escalation ringtone settings**
  * Enable/disable ringtone
  * Choose ringtone
  * Test ringtone
  * Volume level
* Pause / vacation mode
* Legal disclaimer

---

## 6. Backend Logic (Straightforward)

### 6.1 Source of Truth

The backend determines:

* User state
* Missed check-ins
* Escalation

The client only submits events.

---

### 6.2 Core State Machine

States:

* ACTIVE
* GRACE
* ESCALATED
* RESOLVED

Transitions:

* ACTIVE → GRACE (missed check-in)
* GRACE → ACTIVE (late check-in)
* GRACE → ESCALATED (grace expired)
* ESCALATED → RESOLVED (user confirms)

---

### 6.3 Check-in Logic

On check-in:

* Update `last_fine_at`
* Set state = ACTIVE
* Clear pending alerts
* **Stop escalation ringtone (if playing)**

Verification level logged but not blocking unless configured.

---

### 6.4 Scheduler / Cron

Runs every X minutes:

For each user:

* If now > last_fine_at + interval → GRACE
* If now > last_fine_at + interval + grace → ESCALATE

**On escalation:**
* Send push notification with `escalation: true` flag
* Trigger ringtone via push payload
* Notify trusted contacts

---

### 6.5 Notification Escalation

Order (configurable):

1. Push (to user) **with ringtone trigger**
2. Push/Email/SMS (to contacts)

**User notification message:**
> "Check-in missed. Please confirm you're okay."

**Contact notification message:**
> "We haven't received a check-in from Alex. Please try contacting them."

No panic language.

---

## 7. Data Model (MVP)

### User

* id
* email / phone
* last_fine_at
* checkin_interval_hours
* grace_period_hours
* state
* verification_level
* **ringtone_enabled** (boolean, default: true)
* **ringtone_selection** (string, default: "default")
* **ringtone_volume** (integer 0-100, default: 100)

### Contact

* id
* user_id
* channel
* destination
* consented_at

### Alert

* id
* user_id
* triggered_at
* resolved_at
* **ringtone_played_at** (timestamp, nullable)

---

## 8. Security & Privacy

* Minimal data collection
* No continuous tracking
* Hashed verification secrets
* Encrypted at rest
* Explicit consent for contacts
* **Audio permissions only used for escalation ringtone**
* **Ringtone stops immediately on check-in**

---

## 9. Technical Implementation Notes

### 9.1 Ringtone Implementation (Expo)

**Audio handling:**
```javascript
import { Audio } from 'expo-av';

// Configure audio to play even in silent mode
await Audio.setAudioModeAsync({
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  shouldDuckAndroid: false,
});
```

**Push notification handling:**
```javascript
// In notification listener
if (notification.data.escalation === true) {
  playEscalationRingtone();
  showEscalationAlert();
}
```

**Sound files:**
* Include 3-5 preset ringtones (varying urgency levels)
* Format: MP3, ~10-30 seconds, loopable
* Stored in app bundle (no streaming)

---

### 9.2 Background Notification Handling

**iOS:**
* Uses background fetch and remote notifications
* Ringtone may be limited by iOS restrictions (best-effort)

**Android:**
* Full-screen intent for escalation notifications
* Can override Do Not Disturb if user grants permission

**Graceful degradation:**
* If audio permissions denied → standard notification only
* If app killed → push notification still delivers
* Clear messaging about limitations during onboarding

---

### 9.3 Supabase Edge Function Updates

**checkin-monitor function additions:**
```sql
-- When escalating, include ringtone flag
INSERT INTO notification_deliveries (alert_id, channel, destination, payload)
VALUES (
  alert_id,
  'push',
  user_expo_token,
  jsonb_build_object(
    'escalation', true,
    'play_ringtone', user.ringtone_enabled,
    'ringtone_id', user.ringtone_selection
  )
);
```

---

## 10. Legal & App Store Notes

Required copy:

* "This app is not an emergency service."
* "Do not rely on this app for urgent medical or safety needs."
* **"Escalation ringtones are best-effort and may not work if the app is closed or permissions are denied."**

User must acknowledge during onboarding.

**App Store permissions justification:**
* Notifications: Required for check-in reminders and escalation alerts
* Audio: Required to play loud ringtone during escalation to help ensure user awareness

---

## 11. MVP Success Criteria

* Check-in completion rate > 95%
* False escalation rate < 2%
* Median check-in time < 2 seconds
* Zero blocking UX regressions
* **Escalation ringtone plays successfully in >80% of cases (when enabled and permissions granted)**

---

## 12. Future Extensions (Not MVP)

* Auto-confirm windows
* Smart reminders
* Wearable integration
* Contact escalation ladders
* Regional emergency numbers
* **Custom ringtone upload**
* **Gradual volume increase**
* **Location-aware ringtone (louder at home)**

---

## 13. Open Decisions

* Default verification level
* SMS provider
* Paid vs free tier
* Region-specific compliance
* **Default ringtone selection (balance between attention and alarm)**
* **Ringtone loop limit (5 min vs until dismissed)**

---

## 14. Supabase Implementation Architecture

### 14.1 Core Principles

* **Normalized SQL schema** (users, contacts, alerts)
* **Minimal, performant RLS policies**
* **Two edge functions:**
  * `checkin` (user confirms fine)
  * `checkin-monitor` (cron-based state machine)
* **Explicit state transitions** that match the PRD
* **Cron strategy** that avoids client-side background reliability issues
* **Expo client call example**

### 14.2 Architectural Notes (Important)

* Backend is the **only authority** on state
* Edge functions are **idempotent** (safe to retry)
* No RLS logic inside cron — uses service role key
* Notification dispatch is intentionally abstracted to keep v1 simple

---

### 14.3 Auth → Data Boundary

**Identity source of truth:**
* `auth.users.id` is the **only identity**
* `public.users.auth_user_id` is a strict 1:1 mapping
* The client **never sends `user_id`**
* All ownership resolution happens server-side via `auth.uid()`

**RLS is defensive, not permissive:**

Users can:
* Read their own profile
* Update their own profile
* Manage only their contacts
* Read only their alerts

Users **cannot:**
* Insert/delete profiles
* Access other users via guessing UUIDs
* Escalate privileges via malformed requests

**Profile creation is backend-only:**
* Profiles are created through an **edge function**
* Prevents duplicate profiles, spoofed mappings, race conditions on signup

**Check-in flow is hardened:**
* Auth token → `auth.uid()` → internal profile lookup
* No trust in client-supplied identifiers
* Fully RLS-compliant with anon key

---

### 14.4 Production-Grade Reliability

**Idempotent, retry-safe notifications:**
* **Alert uniqueness** enforced at the DB level
* Dedicated `notification_deliveries` table
* Safe retries without duplicate sends
* Clear separation between *alert creation* and *delivery execution*

**Full audit logging (non-negotiable for trust):**
* `user_state_events` logs every state transition
* `notification_events` logs the lifecycle of each notification
* Backend-only writes (clients cannot pollute logs)

**Cron optimized for 10k+ users:**
* SQL-side filtering (no full-table scans in JS)
* Batch processing
* Atomic state transitions
* Escalation guarded by `rowCount` checks

---

### 14.5 Expo Push Notifications (End-to-End)

**Edge function that sends pushes:**
* Dedicated `send-push` function
* Integrates with Expo push API
* Handles escalation payloads with ringtone triggers

**Client-side token registration:**
* User's Expo push token stored in `users` table
* Updated on app launch and after permission grants

**Clear separation:**
* Alert creation (cron) vs delivery execution (push function)
* Ready to plug into existing escalation logic

---

## 15. Operational Considerations

### 15.1 Local Supabase + Expo Dev Checklist

**Environment setup:**
1. Local Supabase instance via Docker
2. Expo development build with push notification capabilities
3. Test push token registration flow
4. Verify cron execution in local environment

**Verification checklist (before prod):**
* [ ] Check-in updates `last_fine_at` correctly
* [ ] State transitions logged in `user_state_events`
* [ ] Grace period triggers reminder notifications
* [ ] Escalation triggers contact notifications
* [ ] Escalation triggers user ringtone (when enabled)
* [ ] Ringtone stops on check-in
* [ ] RLS policies prevent cross-user access
* [ ] Edge functions are idempotent (test retries)

---

### 15.2 Abuse & Edge-Case Modeling

**Disabled permissions:**
* Notifications disabled → Show in-app banner requesting re-enable
* Audio disabled → Escalation works but without ringtone (log this)
* Best-effort approach, clear communication

**Lost devices:**
* User can log in on new device
* Old device push tokens automatically invalidated
* Contacts can report "found user" to pause alerts

**Spam / escalation abuse:**
* Rate limit on manual escalations (if feature added)
* Contacts can opt-out
* Users can see notification history

**False positives:**
* Vacation mode to pause check-ins
* Easy snooze during escalation
* Clear feedback loop for improving intervals

---

### 15.3 Cost Modeling

**Push vs SMS economics:**
* Push: ~$0 (Expo provides free tier for reasonable usage)
* SMS: ~$0.01-0.05 per message (via Twilio/similar)

**Realistic numbers at 10k users:**
* Average: 1 check-in/day = 10k push notifications/day
* Escalations: ~2% = 200 escalations/month
* SMS (if enabled): 200 × 2 contacts = 400 SMS = $4-20/month

**Tiering logic:**
* Free: Push notifications only
* Pro ($3-5/month): SMS escalation, unlimited contacts
* Premium ($10/month): Priority support, custom intervals

**Margins:**
* Clean and predictable
* SMS costs covered by Pro tier
* Push notifications scale efficiently

---

## 16. Position Summary

At this point, your backend is:

* **Safer than most early-stage production systems**
* Architecturally sound for paid users
* Ready for real-world failure modes
* **Enhanced with audible escalation for better user safety**

The addition of escalation ringtones:
* Increases likelihood of user awareness during critical moments
* Maintains respect for user preferences (can be disabled)
* Implemented with graceful degradation (works even if limited by OS)
* Adds minimal complexity to otherwise clean architecture

---

## 17. Design Recommendations & Critical Considerations

### 17.1 User Psychology & Behavior Design

**Cognitive load during escalation:**
* Users in distress may have impaired decision-making
* The "I'm Fine" button should be **impossible to miss**
* Consider adding a "I Need Help" secondary button during escalation
  * Immediately notifies contacts with "User indicates they need help"
  * Captures cases where user is conscious but actually needs assistance
  * Prevents false resolution of genuine emergencies

**Habituation prevention:**
* Daily check-ins can become mindless routine → defeats purpose
* **Recommendation:** Vary the verification method randomly
  * Day 1: Simple tap
  * Day 2: Long press
  * Day 3: Biometric
  * Day 4: Simple math question (3+5=?)
* This maintains cognitive engagement without excessive friction

**False alarm anxiety:**
* Users may fear "bothering" contacts with false alarms
* **Recommendation:** Add "Test Mode"
  * Users can trigger a test escalation that clearly labels itself as a test
  * Contacts receive: "This is a test alert from Alex. No action needed."
  * Builds confidence in the system
  * Helps contacts recognize what a real alert looks like

---

### 17.2 Contact Experience Design

**Critical gap:** The current design focuses on the user but neglects contact experience.

**Contact notification improvements:**

1. **Structured action guidance:**
   ```
   We haven't received a check-in from Alex (last confirmed: 18 hours ago).
   
   Please try:
   1. Calling them directly
   2. Sending a text message
   3. If you can't reach them, consider checking in person or contacting local authorities
   
   This is not an emergency service. Use your judgment.
   ```

2. **Contact dashboard (future, but plan for it):**
   * Web link in notification → simple status page
   * Shows: last check-in time, user's usual check-in pattern
   * Button: "I've reached them" (resolves alert + notifies other contacts)
   * Prevents duplicate welfare checks

3. **Contact consent flow needs detail:**
   * When user adds contact, they receive: "Alex wants to add you as an emergency contact. You'll be notified if they miss a check-in. Do you accept?"
   * Contact clicks link → sees explanation of what they're agreeing to
   * Contact can set their own notification preferences (push vs email vs SMS)

---

### 17.3 Critical Edge Cases (Insufficiently Addressed)

**Scenario 1: User is traveling across time zones**
* **Problem:** Check-in expectations become confusing
* **Solution:** Add "Travel Mode"
  * Temporarily adjusts check-in times to new timezone
  * Or: pauses check-ins with explicit end date
  * Shows contacts: "Alex is traveling until [date]"

**Scenario 2: User's phone dies during grace period**
* **Problem:** They can't check in even if they're fine
* **Solution:** 
  * Web-based check-in option (supabase auth works everywhere)
  * SMS-based check-in: Text "FINE" to a number
  * Contact notification includes: "Their phone may be off. Try other contact methods."

**Scenario 3: User is hospitalized (conscious but can't access phone)**
* **Problem:** Escalation happens, but user can't respond
* **Solution:**
  * "Snooze" should have options: 15min, 1hr, 6hr, 24hr
  * Contacts should see snooze status: "Alert was snoozed 2 hours ago"
  * After 3 snoozes without full check-in, escalate to all contacts with higher urgency

**Scenario 4: Contact is also the user's doctor/caregiver**
* **Problem:** They need more context than a friend would
* **Solution:**
  * Add optional "contact type" field: Friend, Family, Caregiver, Medical
  * Caregiver contacts receive additional info: recent check-in pattern, verification status
  * HIPAA consideration: This is user-initiated, but document clearly

**Scenario 5: User develops dementia/cognitive decline**
* **Problem:** They forget to check in but are physically fine
* **Solution:**
  * Add "Assistance Mode" (user or contact can enable)
  * More frequent reminders (every 4 hours instead of daily)
  * Lower threshold for escalation (but contacts know this is expected)
  * Consider: voice-based check-in ("Say 'I'm fine' to your phone")

---

### 17.4 Notification Fatigue Mitigation

**Problem:** Users who frequently miss check-ins train contacts to ignore alerts.

**Solutions:**

1. **Adaptive intervals:**
   * Track user's actual check-in patterns over 30 days
   * If user consistently checks in at 9 AM, adjust reminder to 8:30 AM
   * Reduce false escalations by 30-40%

2. **Smart grace periods:**
   * If user has never missed a check-in in 90 days → extend grace period by 6 hours
   * If user misses frequently → shorten grace period or suggest mode change

3. **Contact fatigue detection:**
   * If same contact gets 3+ alerts in 30 days → show user a warning
   * Suggest: adding more contacts, adjusting intervals, or using vacation mode
   * Prevents relationship strain

---

### 17.5 Accessibility Requirements (Currently Missing)

**Visual impairments:**
* Minimum font size: 18pt for primary actions
* VoiceOver/TalkBack support for all screens
* High contrast mode (not just design preference, but setting)
* Voice-based check-in option

**Motor impairments:**
* "Long press" verification may be difficult
* Alternative: Swipe gesture, or double-tap with delay
* Larger tap targets (minimum 44x44pt, recommend 60x60pt for primary action)

**Cognitive impairments:**
* Simple language (currently good)
* Add pictograms/icons to reinforce text
* Consistent placement of "I'm Fine" button (never moves)
* Option to disable verification for users who can't handle complexity

**Hearing impairments:**
* Ringtone is irrelevant; ensure visual alerts are strong
* Full-screen flashing border during escalation
* Vibration pattern (if supported and enabled)

---

### 17.6 Data Privacy Enhancements

**Currently specified: minimal data collection. Add specifics:**

1. **Data retention policy:**
   * Check-in timestamps: kept for 90 days, then deleted
   * State transition logs: kept for 1 year for debugging
   * Contact information: deleted immediately when removed
   * User can request full data export (GDPR compliance)

2. **Contact privacy:**
   * Contacts don't see each other's information
   * User's last check-in time is only shown to contacts during escalation
   * No aggregated data shared with third parties

3. **Breach response plan:**
   * If Supabase is compromised, worst case: attacker knows check-in timestamps
   * No location data, no health data, no sensitive content
   * Still: plan for notification to users within 72 hours

---

### 17.7 Monetization & Sustainability

**Current "Open Decisions" mentions paid tiers. Specific recommendations:**

**Free tier (ad-free, must be genuinely useful):**
* 1 check-in per day
* 2 trusted contacts
* Push notifications only
* 30-day check-in history

**Pro tier ($3.99/month or $39/year):**
* Custom intervals (down to 4 hours)
* Unlimited contacts
* SMS escalation (2 contacts)
* 1-year history
* Travel mode
* Priority support

**Family tier ($9.99/month):**
* Up to 5 users
* Shared contact pool (family members can be mutual contacts)
* Admin can view all family members' status
* Useful for: families with elderly parents, roommates, remote workers in same company

**Enterprise tier (custom pricing):**
* For: remote worker companies, lone worker industries
* Admin dashboard
* Compliance reports
* SSO integration
* SLA guarantees

**Why this works:**
* Free tier is genuinely useful (not a trial)
* Pro tier pricing covers SMS costs + margin
* Family/Enterprise tiers have high perceived value
* No artificial limitations that hurt safety

---

### 17.8 Ethical Considerations (Non-Negotiable)

**Coercion prevention:**
* **Risk:** Abusive partner forces victim to use app to monitor them
* **Mitigation:**
  * Cannot add contacts without their explicit consent
  * User can see who their contacts are (transparency)
  * Contacts can opt-out at any time
  * Grace period ensures user has time to respond without immediate alert
  * Document in TOS: "This app is not for surveillance"

**Liability disclaimer (strengthen current version):**
* Current: "This app is not an emergency service."
* **Add:** 
  * "We cannot guarantee notifications will be delivered."
  * "Contacts are not obligated to respond."
  * "Do not use this app as your only safety measure."
  * "In immediate danger, call [local emergency number]."

**Vulnerable populations:**
* Elderly users may not understand technology limitations
* Clear, repeated explanations during onboarding
* Consider: optional "guardian" role who helps set up but isn't a contact

---

### 17.9 Technical Debt & Future-Proofing

**Decisions that will be expensive to change later:**

1. **Check-in interval stored as hours (integer):**
   * Problem: Can't support "every 2.5 days" or "twice per day"
   * **Fix now:** Store as minutes (integer) or use ISO 8601 duration string
   * Small change, huge flexibility gain

2. **Single verification level per user:**
   * Problem: User might want biometric at night, simple tap during day
   * **Fix now:** Make verification level time-based or context-based
   * Or: accept this limitation for MVP, document for v2

3. **Contact notification order is configurable but not priority-based:**
   * Problem: User might want "try push first, if no response in 30 min, send SMS"
   * **Fix now:** Add `escalation_delay_minutes` per contact
   * Or: accept simple "all at once" model for MVP

4. **No webhook support:**
   * **Add now:** Allow user to specify a webhook URL for check-ins
   * Enables: integration with home automation, other apps
   * Minimal effort, huge flexibility

---

### 17.10 Launch & Growth Strategy

**Soft launch recommendations:**

1. **Beta with specific cohort:**
   * Target: Remote workers in tech (they'll give detailed feedback)
   * Size: 100-500 users
   * Duration: 3 months
   * Goal: Validate 95% check-in rate, <2% false escalation

2. **Feedback loops:**
   * In-app: After every escalation, ask user "What happened?"
   * Contact survey: After first alert, ask contact about experience
   * Metric: Net Promoter Score (target: >40 for MVP)

3. **Word-of-mouth growth:**
   * Primary growth vector: Contacts become users
   * When contact receives alert, include: "Alex uses ImFine. Want peace of mind too?"
   * Incentive: Free month of Pro for both user and contact who signs up

4. **Positioning:**
   * Don't compete with: Medical alert systems, emergency services
   * Do compete with: "Texting your roommate every morning"
   * Tagline ideas:
     * "The check-in app for people who live alone"
     * "Peace of mind for you and the people who care"
     * "Because someone should know you're okay"

---

### 17.11 Success Metrics (Beyond Current PRD)

**Current metrics are good. Add:**

**User engagement:**
* Check-in streak (how many consecutive days without missing)
* Time to first check-in after reminder (measures friction)
* Settings adjustment frequency (too high = confusing)

**Contact health:**
* % of contacts who consent vs decline
* Contact opt-out rate (should be <5%)
* Time for contact to acknowledge they received alert

**Business metrics:**
* Free-to-paid conversion rate (target: 10-15% after 3 months)
* Churn rate (target: <5% monthly for paid)
* Support ticket volume per 1000 users (target: <20/month)

**Safety metrics:**
* True positive rate (escalations where user actually needed help)
* False negative rate (user needed help but didn't escalate) — hard to measure, but survey contacts
* Time to resolution (from escalation to user checking in)

---

### 17.12 Failure Mode Analysis

**What happens if:**

1. **Supabase goes down:**
   * User can't check in → automatic grace period extension
   * Queue check-ins locally, sync when back online
   * Contact notifications delayed but eventually sent
   * **Add:** Status page that shows system health

2. **Expo Push service goes down:**
   * Fallback to email immediately
   * User sees in-app warning: "Push notifications may be delayed"
   * Document this in onboarding

3. **User's account is hacked:**
   * Attacker could disable check-ins
   * **Mitigation:** Require email confirmation for critical changes
   * Contacts receive: "Alex changed their check-in settings. Is this expected?"

4. **Mass false escalations (bug in cron):**
   * Could notify thousands of contacts unnecessarily
   * **Mitigation:** Rate limit per user (max 1 escalation per hour)
   * **Mitigation:** Kill switch to pause all escalations (admin-only)
   * **Mitigation:** Canary deployment for cron changes

---

### 17.13 Legal & Compliance Checklist

**Before launch:**

- [ ] Terms of Service reviewed by lawyer
- [ ] Privacy Policy covers all data collection
- [ ] GDPR compliance (if serving EU users)
  - [ ] Right to deletion
  - [ ] Right to data export
  - [ ] Consent mechanism for contacts
- [ ] CCPA compliance (if serving California users)
- [ ] Accessibility compliance (WCAG 2.1 AA minimum)
- [ ] Age verification (13+ due to COPPA, or 16+ to be safe)
- [ ] Contact notification consent is legally defensible
- [ ] Insurance: Errors & Omissions coverage recommended

---

### 17.14 When to Pivot or Kill the Product

**Red flags that MVP assumptions are wrong:**

1. **Check-in completion rate <80%:**
   * Means: friction is too high or value proposition is unclear
   * Action: User interviews to find friction points

2. **False escalation rate >10%:**
   * Means: intervals are too aggressive or grace periods too short
   * Action: Make defaults more conservative

3. **Contact opt-out rate >20%:**
   * Means: contacts feel burdened or don't see value
   * Action: Reduce notification frequency, improve contact experience

4. **Churn rate >10% monthly:**
   * Means: product doesn't deliver ongoing value
   * Action: Add engagement features (but carefully, avoid feature creep)

5. **True positive rate <5% of escalations:**
   * Means: most escalations are false alarms
   * Action: This might be okay (peace of mind), but measure contact satisfaction

**When to kill the product:**
* If liability concerns outweigh revenue potential
* If costs scale faster than revenue (SMS costs explode)
* If a genuine emergency occurs and the app fails catastrophically
* If user growth stalls at <5k users for 6+ months (not sustainable)

---

## 18. Final Architectural Recommendations

### 18.1 Code Organization

**Expo app structure:**
```
/src
  /screens
    HomeScreen.tsx (check-in button)
    EscalationScreen.tsx (full-screen takeover)
    ContactsScreen.tsx
    SettingsScreen.tsx
  /components
    CheckInButton.tsx
    ContactCard.tsx
  /services
    supabase.ts (client config)
    notifications.ts (Expo push)
    audio.ts (ringtone management)
  /hooks
    useCheckInStatus.ts (real-time state from Supabase)
    useEscalation.ts (handles ringtone + alert)
  /utils
    verification.ts (biometric + long press)
```

**Supabase structure:**
```
/supabase
  /migrations
    001_initial_schema.sql
    002_add_ringtone_settings.sql
  /functions
    checkin/
      index.ts
    checkin-monitor/
      index.ts
    send-push/
      index.ts
```

### 18.2 Testing Strategy

**Must-test before launch:**

1. **Notification delivery:**
   * Set check-in interval to 5 minutes
   * Let it escalate
   * Verify: push received, ringtone plays, contacts notified

2. **State transitions:**
   * Mock: user in GRACE, then checks in → should go to ACTIVE
   * Mock: user in ESCALATED, then checks in → should go to RESOLVED

3. **RLS policies:**
   * Try to access another user's data via direct API call
   * Should fail with 403

4. **Idempotency:**
   * Trigger cron multiple times with same data
   * Should not send duplicate notifications

5. **Permissions degradation:**
   * Disable notifications → app should show warning
   * Disable audio → escalation should work without ringtone

---

## 19. Summary: What Makes This Product Work

**The app succeeds if:**

1. It's **effortless** to use (single tap, 2 seconds)
2. It's **reliable** (backend is source of truth, not client)
3. It's **respectful** (contacts consent, users have control)
4. It's **transparent** (clear about limitations, not an emergency service)
5. It **degrades gracefully** (works even with limited permissions)
6. It's **trustworthy** (audit logs, predictable behavior)

**The app fails if:**

1. Users feel nagged (too many notifications)
2. Contacts feel burdened (too many false alarms)
3. It gives false sense of security (must be clear about limitations)
4. It's used for surveillance (must prevent coercion)
5. Technical complexity leads to bugs (keep it simple)

---

## 20. Next Steps for Implementation

**Step 1: Foundation**
- [ ] Set up Supabase project
- [ ] Create schema (users, contacts, alerts, logs)
- [ ] Set up RLS policies
- [ ] Create Expo app skeleton

**Step 2: Core Flow**
- [ ] Implement check-in button + API call
- [ ] Implement state machine in Edge Function
- [ ] Test state transitions manually

**Step 3: Notifications**
- [ ] Set up Expo Push
- [ ] Implement contact notification logic
- [ ] Test end-to-end escalation flow

**Step 4: Escalation Ringtone**
- [ ] Integrate expo-av
- [ ] Implement full-screen escalation alert
- [ ] Test on both iOS and Android

**Step 5: Polish**
- [ ] Onboarding flow
- [ ] Settings screen
- [ ] Vacation mode
- [ ] Legal disclaimers

**Step 6: Testing & Beta**
- [ ] Test all edge cases
- [ ] Invite 50-100 beta users
- [ ] Monitor for 2 Steps
- [ ] Iterate based on feedback

**Step 7: Launch Prep**
- [ ] App Store / Play Store submissions
- [ ] Status page
- [ ] Support documentation
- [ ] Marketing site

**Step 8: Launch**
- [ ] Soft launch to beta users' contacts
- [ ] Monitor closely for first 72 hours
- [ ] Fix critical bugs immediately
- [ ] Gather feedback

---

**End of MVP document + recommendations**


Build a mobile app called "ImFine" using Expo React Native. The app allows users to confirm they are fine at regular intervals and notifies trusted contacts if they fail to check in.

CORE REQUIREMENTS:
* Simple, single-tap check-in button (no secondary CTAs on home screen)
* Configurable check-in interval (default: 24h) and grace period (default: 12h)
* State machine: ACTIVE → GRACE → ESCALATED → RESOLVED
* Escalation triggers loud ringtone on user's device (max volume, loops until check-in)
* Full-screen escalation alert that takes over the app
* Trusted contacts management (push required; email/SMS optional)
* Optional verification (biometric or long press) to prevent false check-ins
* Vacation/pause mode to stop check-ins temporarily

BACKEND ARCHITECTURE:
* Backend is the single source of truth for all state
* Client never sends user_id; all ownership via auth.uid()
* Row Level Security (RLS) enforces user data isolation
* Supabase Edge Functions:
  - checkin: User confirms they're fine
  - checkin-monitor: Cron job that detects missed check-ins and triggers escalations
* State transitions logged in user_state_events (audit table)
* Notification lifecycle logged in notification_events (audit table)
* notification_deliveries table ensures idempotent, retry-safe delivery

NOTIFICATIONS:
* Expo Push for user reminders and escalation alerts
* Push payload includes escalation flag to trigger ringtone
* Contact notifications via push/email/SMS (user configurable)
* Graceful degradation if permissions denied

SECURITY & PRIVACY:
* Minimal data collection (no GPS, no continuous tracking)
* Explicit consent from contacts before notifications
* Auth via Supabase Auth (email-based)
* Profile creation via backend edge function only (prevents spoofing)
* Clear disclaimers: "This is not an emergency service"

UX REQUIREMENTS:
* Calm, neutral design (except escalation state)
* Large tap targets, high contrast
* Auto-dismiss confirmation screen after 2 seconds
* Settings: intervals, grace period, ringtone preferences, contacts
* Onboarding: value prop → account → intervals → contacts → permissions

TECHNICAL STACK:
* Frontend: Expo React Native (managed workflow)
* Backend: Supabase (Auth, Postgres, Edge Functions, Cron)
* Audio: expo-av for escalation ringtone
* Notifications: Expo Push Notifications

GOAL:
Ship a minimal, reliable, trustworthy MVP that:
* Handles 10k+ users
* Has 95%+ check-in completion rate
* Has <2% false escalation rate
* Is safe and respectful to users' contacts
* Works even when app is backgrounded (via backend cron)
* Degrades gracefully when permissions are limited