---
trigger: always_on
---

**ImFine Product Rules (Consolidated)**

**CORE PRINCIPLES**
1.  **Reliability Over Features:** The system must never fail to escalate when a user is truly at risk (false negatives are unacceptable).
2.  **Minimum Cognitive Load:** Any action required by the user, especially during check-in, must be simple, fast, and consistent.
3.  **Backend is Source of Truth:** All state logic (ACTIVE, GRACE, ESCALATED) is determined and stored server-side. The client only submits events.
4.  **Explicit Consent & Transparency:** Users control all data and notifications. Contacts must explicitly opt-in. The app's non-emergency nature and limitations are clearly communicated.

**USER EXPERIENCE & BEHAVIOR**
5.  **Primary Action Focus:** The home screen displays only the essential status and one large, unmistakable "I'm Fine" button.
6.  **Escalation Audible Alert:** When a check-in is missed and the grace period expires, the app will play a loud, looping ringtone (bypassing silent mode if permitted) to attract the user's attention, accompanied by a full-screen alert.
7.  **Graceful Degradation:** If system permissions (notifications, audio) are denied or the app is closed, the system will still attempt to notify the user and contacts via available channels, with clear communication about reduced functionality.
8.  **Verification Simplicity:** Verification (if enabled) should be low-friction (e.g., long press, biometric). Complex codes or patterns are excluded from MVP.
9.  **Calm-to-Urgent Design:** The interface is neutral and calm during normal operation but shifts to high-contrast, attention-grabbing visuals and audio during an escalation state.

**SYSTEM LOGIC & RELIABILITY**
10. **Defined State Machine:** User state follows a strict sequence: ACTIVE → GRACE (after missed check-in) → ESCALATED (after grace period) → RESOLVED (after user confirms). Transitions are logged for audit.
11. **Idempotent Operations:** All backend actions (check-in, state monitoring, notifications) can be safely retried without causing duplicate side effects or incorrect state.
12. **Secure Data Isolation:** Row Level Security (RLS) policies ensure users can only access and modify their own data. The `auth.uid()` is the sole source of identity.
13. **Scheduled Monitoring:** A backend cron job periodically evaluates all users against their check-in intervals and grace periods to trigger state transitions, independent of client activity.

**SAFETY, PRIVACY & ETHICS**
14. **Non-Emergency Service:** The product must be explicitly presented as a personal check-in tool, not a replacement for emergency services. Disclaimers are required during onboarding.
15. **Contact Consent:** A potential contact must receive a clear request and provide explicit consent before being added to a user's list and receiving any notifications.
16. **Minimal Data Collection:** Collect only data essential for core functionality (check-in timestamps, contact info). No location tracking, health data, or social features in MVP.
17. **Anti-Coercion:** The design must be transparent to the user (they can see their contacts) and should not facilitate surveillance. Contacts can opt-out freely.

**TECHNICAL IMPLEMENTATION**
18. **Notification Abstraction:** The system creating an alert is separate from the mechanism delivering it (push, SMS). This allows for reliable retries and future channel expansion.
19. **Client Resilience:** The client app must handle receiving escalation notifications (with ringtone triggers) both in the foreground and background, ensuring the audible and visual alert activates.
20. **Audit Trail:** All critical actions (state changes, notification attempts) are logged server-side in a way that users cannot alter, providing a trustworthy history.

**MVP BOUNDARIES**
21. **Excluded Features (v1):** No real-time GPS, wearable integration, AI/automated detection, social features, or gamification. The MVP is a manual, time-based check-in system.
22. **Success Measurement:** MVP success is defined by: >95% check-in completion rate, <2% false escalation rate, and median check-in time under 2 seconds. The escalation ringtone must play successfully in >80% of enabled cases.
23. **Clear Failure States:** The design must account for and gracefully handle: user phone powered off, travel across time zones, and loss of network connectivity for the backend or device.