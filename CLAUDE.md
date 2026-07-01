@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16 App Router (TypeScript) + Supabase (auth, PostgreSQL, RLS) + Tailwind v4 + shadcn/ui. Deployed to Vercel.

## Commands

```bash
npm run dev          # start dev server on :3000
npm run build        # production build
npm run lint         # eslint
```

Copy `.env.local.example` to `.env.local` and fill in Supabase credentials before running.

## Architecture

### UI

- **`app/`** - web UI with `AppShell` (sidebar + navbar), used by counsellors and admins in a browser.

### Auth

Invite-only. Flow: admin generates token -> user visits `/join?token=...` -> Supabase `signUp` with `invite_token` in metadata -> DB trigger `handle_new_user` creates `users` row with the invite's assigned role.

**Three roles:** `admin` (full CRUD), `counsellor` (read + sensitive), `viewer` (read, no sensitive fields).

### Permission model

`lib/auth.ts` -> `can(profile, overrides, resource, action)`:
1. Checks `permissions` table for a per-user override row.
2. Falls back to `ROLE_DEFAULTS` in `lib/supabase/types.ts`.

Server-side pages enforce this; RLS enforces it again at the DB layer. Never rely solely on client-side checks.

### Middleware (`proxy.ts`)

Runs on every non-static request. In order:
1. IP ban check (via service-role `bans` table, bypasses RLS)
2. Lockdown mode check (`site_config.lockdown_mode = 'true'`) -> redirects to `/lockdown`
3. Auth check -> redirect unauthenticated users to `/login`
4. User ban check

Exempt paths: `/lockdown`, `/unlock`, `/banned`, `/login`, `/join`, `/setup`, `/api/setup`, `/api/lockdown`.

### Supabase clients

| File | Purpose |
|---|---|
| `lib/supabase/server.ts` | Cookie-based SSR client - use in Server Components and Route Handlers |
| `lib/supabase/client.ts` | Browser client - use in Client Components |
| `lib/supabase/admin.ts` | Service-role client - bypasses RLS; only for trusted server code |

### Sensitive fields

`personal_notes` (incidents) and `personal_reflection` (tracker sessions) are hidden from `viewer` role. Server-side `[id]/page.tsx` files null these out using `safeIncident`/`safeSession` patterns before passing to client components. Never expose them client-side without a `can(..., 'view_sensitive')` check.

### Database schema (migrations in order)

1. `001_initial.sql` - core tables: `users`, `invites`, `mental_health_incidents`, `drug_tracker_sessions`, `sleep_log`, `documents`, `permissions`; RLS policies; `handle_new_user` trigger
2. `002_sensitive_fields.sql` - `sensitive_fields` column + emergency/police/ambulance flags
3. `003_incident_extra_fields.sql` - names, substance use, people involved
4. `004_incident_enhancements.sql` - `police_called`, `ambulance_called`, `was_arrested`, `was_sectioned`, `people_involved[]`, `tracker_session_id` FK
5. `005_drug_use_log.sql` - `drug_use_log` table (substance, amount, unit per session)
6. `006_admin_features.sql` - `site_config` (lockdown, site name), `bans` (user/IP), `activity_logs`

### Activity logging

`lib/activity.ts` -> `logActivity(params)` writes to `activity_logs` via the admin client. Call it in Route Handlers for any write operation; admins see it in the admin panel.
