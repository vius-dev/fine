# FineApp

**FineApp** is a low-friction personal safety application designed to provide peace of mind for people living alone, remote workers, and anyone who wants a safety net. It allows users to periodically confirm they are "fine". If a check-in is missed, the system automatically notifies trusted contacts.

> **Note**: This is not an emergency response service. It is a tool for personal reassurance and connectivity.

## 🚀 Key Features

- **Daily Check-ins**: A simple, single-tap interface to confirm you are safe.
- **Grace Periods**: Configurable window (e.g., 1 hour) after a missed check-in before sending alerts.
- **Smart Escalation**: If the grace period expires, the app enters an "Escalated" state.
- **Audible Alerts**: Can play a loud ringtone on your device during escalation (if enabled) to ensure you didn't just sleep through a notification.
- **Trusted Contacts**: Invite friends or family to receive notifications if you fail to check in.
- **Privacy First**: Contacts are only notified when strictly necessary. No continuous location tracking.

## 🛠️ Tech Stack

- **Frontend**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 54)
- **Backend/DB**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Edge Functions**: Deno-based serverless functions for critical logic (cron jobs, notification dispatch).
- **Navigation**: Expo Router.

## 📦 Getting Started

### Prerequisites

- Node.js (v18+)
- [Expo Go](https://expo.dev/client) app on your phone, or an Android Emulator/iOS Simulator.
- A Supabase project.

### Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd fineapp
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```


3.  **Run the App**:
    ```bash
    npx expo start
    ```
    Scan the QR code with your phone (using Expo Go or camera app).

### Backend Setup (Supabase)


```

## 📄 License

[MIT](LICENSE)
