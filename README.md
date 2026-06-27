# Mental Health Tracker

Basic private tracker for incident entries and session tracking.

## What the Android wrapper does

The Android app is wrapped with Capacitor. It opens the hosted Next.js app inside an Android WebView and starts at `/mobile`, which gives a phone-first screen for:

- adding incident entries
- viewing incident history
- starting/opening tracker sessions
- viewing session history
- logging sleep, usage, notes, and closing sessions through the existing tracker screens

This keeps the same Supabase backend and login system already used by the web app.

## Android setup from Windows CMD

Install dependencies:

```cmd
npm install
```

Build/check the web app:

```cmd
npm run build
```

Set the hosted app URL. Replace the URL with your real deployed Next.js site URL:

```cmd
set CAPACITOR_SERVER_URL=https://YOUR-DEPLOYED-SITE.vercel.app
```

Create the Android native project the first time only:

```cmd
npm run android:init
```

Sync the Android project after app changes:

```cmd
npm run android:sync
```

Open it in Android Studio:

```cmd
npm run android:open
```

Build a debug APK from CMD:

```cmd
npm run android:build:debug
```

The debug APK will be created at:

```cmd
android\app\build\outputs\apk\debug\app-debug.apk
```

## Important

The Android wrapper needs the Next.js app deployed somewhere first because this project currently uses Next server/auth behaviour. A fully offline Android bundle would need a separate client-only rewrite of the auth and Supabase screens.
