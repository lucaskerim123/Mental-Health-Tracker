@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js App Router (TypeScript) + Supabase (auth, PostgreSQL, storage) + Tailwind + shadcn/ui. Deployed to Vercel.

## Commands

```bash
npm run dev          # start dev server on :3000
npm run build        # production build
npm run lint         # eslint
```

Copy `.env.local.example` → `.env.local` and fill in Supabase credentials before running.

## Architecture

**Roles**: `admin` (full control) · `counsellor` (read-only, sees sensitive fields) · `viewer` (read-only, no sensitive fields)  
**Auth**: Invite-only. Admin generates tokens → `/join?token=…` → Supabase `signUp` → DB trigger creates `users` row with role.  
**Permission overrides**: `permissions` table stores per-user `(resource, action, granted)` rows that override role defaults. `ROLE_DEFAULTS` in `lib/supabase/types.ts` defines baseline per-role access.

**Key files**:
- `lib/auth.ts` — `getProfile()`, `getPermissions()`, `can()` for server-side auth checks
- `lib/supabase/types.ts` — all TypeScript types + `ROLE_DEFAULTS` matrix
- `supabase/migrations/001_initial.sql` — full schema, RLS policies, and `handle_new_user` trigger
- `proxy.ts` — protects all routes except `/login` and `/join` (Next.js 16 renamed `middleware` → `proxy`)

**Data flow**: Server components fetch data via `lib/supabase/server.ts` and pass to Client components. Mutations happen client-side via `lib/supabase/client.ts`. RLS enforces access at the DB layer — never trust client-side role checks alone.

**Sensitive fields**: `personal_notes` (incidents), `personal_reflection` (tracker sessions) are hidden for `viewer` role. Server-side pages null these fields before passing to client components (`safeIncident`, `safeSession` patterns in `[id]/page.tsx`).

**Sleep counter**: Additive — stores running total in `drug_tracker_sessions.sleep_hours`, logs each addition in `sleep_log` for audit trail.
