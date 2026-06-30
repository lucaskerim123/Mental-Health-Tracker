# Mental Health Tracker

Basic private tracker for incident entries and session tracking.

## MCP setup

This repo uses one custom MCP server implementation at `mcp/his-py/server.py`.
The transport changes by client:

- Claude uses stdio through `.mcp.json`
- ChatGPT uses streamable HTTP through the shared launcher

### One-click launcher

If you are on Windows, the preferred launcher is
`bin\Mental-Health-Tracker-Launcher.exe`. It starts the ChatGPT-mode MCP
server, tries to launch ngrok on port `8001`, checks the local port, and opens
Codex in the repo directory.

If you want a desktop icon, run `bin\create-desktop-shortcut.ps1` once. It
creates a shortcut that points to the packaged `.exe` when present, otherwise
it falls back to `bin\launch-codex-mcp.cmd`.

The launcher also tries to read ngrok's local API and prints the public tunnel
URL when available. It copies that URL to the clipboard.

To rebuild the `.exe`, run `bin\build-launcher-exe.ps1`.

### Claude setup

Claude should use the local `.mcp.json` config. The active server name is `his`.

### ChatGPT setup

Start the same server in ChatGPT mode:

```powershell
.\mcp\his-py\start-mcp.ps1 -Mode ChatGPT
```

By default the server listens at:

```text
http://127.0.0.1:8001/mcp
```

Expose that local URL through an HTTPS tunnel, then add the public tunnel URL
ending in `/mcp` as the ChatGPT MCP connector URL.

Environment required by the MCP server:

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HIS_USER_ID`

## What the Android wrapper does

The Android app is wrapped with Capacitor. It opens the hosted Next.js app inside an Android WebView and starts at `/mobile`, which gives a phone-first screen for:

- adding incident entries
- viewing incident history
- starting/opening tracker sessions
- viewing session history
- logging sleep, usage, notes, and closing sessions through the existing tracker screens

This keeps the same Supabase backend and login system already used by the web app.

Default Android app URL:

```cmd
https://public-mhtracker.vercel.app/mobile
```

## Android setup from Windows CMD

Install dependencies:

```cmd
npm install
```

Build/check the web app:

```cmd
npm run build
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

## Optional URL override

The app defaults to `https://public-mhtracker.vercel.app`. To point the Android wrapper at a different deployed site for testing, run this before syncing Android:

```cmd
set CAPACITOR_SERVER_URL=https://your-other-site.vercel.app
npm run android:sync
```

## Important

The Android wrapper needs the Next.js app deployed somewhere first because this project currently uses Next server/auth behaviour. A fully offline Android bundle would need a separate client-only rewrite of the auth and Supabase screens.
