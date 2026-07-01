# Plan 2 Implementation - Session Tracker

Source plan: `docs/plans/plan-2-session-tracker.md`

Scope rule: implement in this repository folder only. Do not apply migrations to Supabase, do not push to GitHub, and do not rename existing database tables unless explicitly approved.

## Current Repo Findings

- The UI currently uses `Tracker`; Plan 2 requires the user-facing label `Session Tracker`.
- Keep the backend table name `drug_tracker_sessions`.
- Existing migrations include:
  - `drug_tracker_sessions`
  - `sleep_log`
  - `drug_use_log`
  - `tracker_entries`
  - `mental_health_incidents.tracker_session_id`
- The app already queries `session_events`, `session_moods`, and `session_notes`, but these tables are not present in the current migration folder.
- The Python MCP currently writes to:
  - `drug_tracker_sessions`
  - `sleep_log`
  - `drug_use_log`
  - `mental_health_incidents`
- The MCP must not be broken. Additive DB changes should be introduced with fallbacks before MCP output depends on them.

## Non-Negotiables

- Keep `drug_tracker_sessions.id` as the internal UUID.
- Add `drug_tracker_sessions.session_number` for the locked display ID.
- Display sessions as `Session #1`, `Session #2`, etc.
- Do not allow the app, admin, viewer, counsellor, lawyer, or MCP to edit `session_number`.
- Use `mental_health_incidents.tracker_session_id` for incident linking.
- Keep current sleep logic and `Day X` calculation.
- Hide empty lower sections.
- If a restricted section has content, show the section label and `REDACTED`.

## Local SQL File

The local-only schema proposal is in:

`docs/schema/plan-2-session-tracker-schema.sql`

This SQL is for review and future migration creation only. It should not be applied without approval.

## Data Model

### `drug_tracker_sessions`

Add:

- `session_number bigint`
- `brief_notes text`
- `counsellor_notes text`
- `lawyer_notes text`
- `field_visibility jsonb not null default ...`

Visibility defaults:

```json
{
  "brief_notes": "viewer+",
  "notes": "counsellor+",
  "usage_log": "counsellor+",
  "counsellor_notes": "counsellor+",
  "lawyer_notes": "lawyer+",
  "private_notes": "admin only",
  "mcp_outputs": "admin only"
}
```

Keep existing columns:

- `notes`
- `personal_reflection`
- `any_incidents`
- `sensitive_fields`
- `is_sensitive`

These can remain available for older MCP/app behavior while new UI sections move toward structured quick entries.

### `session_number`

Rules:

- Backfill existing sessions ordered by `created_at`, then `date_start`, then `id`.
- Future rows receive the next sequence value.
- Add a unique index.
- Add a trigger that rejects edits after creation.
- MCP can read and display this value but must not update it.

### Sleep Log

Keep:

- `sleep_log.session_id`
- `sleep_log.hours_added`
- `sleep_log.logged_at`
- `drug_tracker_sessions.sleep_hours`

The app and MCP should both continue writing sleep entries to `sleep_log` and updating the session total.

Detail display:

- Quick hours entry.
- List of sleep entries.
- Total sleep hours.
- Time since last sleep.
- Closed session final sleep total.

### Mood/Feeling Entries

Preferred table:

- `session_moods`

Required fields:

- `session_id`
- `mood`
- `notes`
- `source`
- `occurred_at`
- `created_at`

The current app already queries `session_moods`, so the implementation should either add the missing migration or confirm the table already exists in the live database before relying on it.

### Usage Log

Keep:

- `drug_use_log`

Required behavior:

- Quick entry from app.
- Quick entry from MCP.
- Default `substance` to `ice`.
- Hide when empty.
- Default section visibility to `counsellor+` unless changed.
- If restricted, show `Usage log: REDACTED`.

### Notes

Preferred table:

- `session_notes`

Plan 2 requires quick note entries, not one saved textbox.

Required behavior:

- App creates new note rows.
- MCP creates new note rows.
- Notes are connected by `session_id`.
- Notes support `source`, `entry_type`, `content`, `metadata`, `visibility`, and timestamp.
- Hide when empty.
- If restricted, show `Notes: REDACTED`.

Fallback compatibility:

- Keep `drug_tracker_sessions.notes` so existing MCP behavior does not break.
- After the note table is confirmed, MCP can write to `session_notes` and optionally mirror summary output to legacy `notes` if needed.

### Connected Incidents

Use existing field:

- `mental_health_incidents.tracker_session_id`

Required behavior:

- Session detail shows linked incident list.
- Session detail supports linking existing incidents to the current session.
- Incident pickers show `Session #`.
- Connected incident section hides when empty.
- MCP must use the same `tracker_session_id` relationship.

### Counsellor, Lawyer, and Private Notes

Fields:

- `drug_tracker_sessions.counsellor_notes`
- `drug_tracker_sessions.lawyer_notes`
- Existing `drug_tracker_sessions.personal_reflection` can remain the private/admin note until a separate `private_notes` field is approved.

Visibility:

- Counsellor notes: `counsellor+`
- Lawyer notes: `lawyer+`
- Private notes: `admin only`

Because the current app role enum is `admin | counsellor | viewer`, `lawyer+` should be treated as lawyer/admin capable in shared helpers but only admin-visible until a lawyer role migration is approved.

### Log Entries / MCP Outputs

Preferred existing table:

- `tracker_entries`

Extend:

- `entry_type`
- `metadata`
- `visibility`
- `incident_id`

Required behavior:

- Bottom of session detail page.
- Read-only unless later approved.
- Hide when empty.
- Default visible to admin only.
- If restricted, show `Log entires (outputs from mcp): REDACTED`.
- Display timestamp, source, entry type, output text, related session, and related incident if linked.

Note: keep the spelling `Log entires` where matching the plan/UI request, unless the user approves correcting it to `Log entries`.

## App Implementation Checklist

1. Change UI labels from `Tracker` to `Session Tracker` without changing routes or table names unless separately approved.
2. Add session label helper, for example `sessionLabel(session)`.
3. Extend local TypeScript types for session fields and tracker entry fields.
4. Add shared session visibility helpers:
   - `DEFAULT_SESSION_FIELD_VISIBILITY`
   - `normalizeSessionVisibility`
   - `canViewSessionField`
   - `visibleSessionText`
5. Update session list/history to show `Session #`.
6. Update session detail top section:
   - `Session #`
   - active/closed status
   - `Day X`
   - started date
   - ended date
   - total days
   - final sleep total
   - linked incident count
7. Keep sleep log functionality and add total/time-since-last-sleep display where missing.
8. Add brief notes textbox and lock/visibility control.
9. Add mood quick-entry section.
10. Update usage quick-entry to default to `ice`.
11. Replace saved Notes textbox behavior with quick note entries using `session_notes` after schema is approved.
12. Add connected incident picker/list using `tracker_session_id`.
13. Add counsellor notes, lawyer notes, and private notes sections.
14. Add bottom MCP output/log entries section using `tracker_entries`.
15. Apply hide-if-empty and restricted `REDACTED` display rules consistently.
16. Update mobile session surfaces to show `Session #` and respect redaction.

## MCP Implementation Checklist

Do this only after the DB shape is approved.

1. Keep existing constants for current tables.
2. Add safe read support for `session_number`.
3. Add display helper that returns `Session #${session_number}` with UUID fallback.
4. Keep existing sleep command writing to `sleep_log` and updating `sleep_hours`.
5. Keep existing usage command writing to `drug_use_log`, defaulting substance to `ice` when omitted or when using the new command path.
6. Add MCP note command support for `session_notes` after the table is confirmed.
7. Add MCP mood command support for `session_moods` after the table is confirmed.
8. Add MCP output logging to `tracker_entries` with `source = 'mcp'`.
9. Add fallbacks so Claude's current MCP flow continues if new columns/tables do not exist yet.
10. Never write to `session_number`.

## Verification

Run before considering implementation complete:

```powershell
npm run build
```

If implementing the SQL as a migration later, also test against a local Supabase/Postgres instance before applying to production.

## Approval Gates

Require explicit approval before:

- Applying SQL to Supabase.
- Adding or changing enum roles, especially `lawyer`.
- Renaming routes from `/tracker` to `/sessions`.
- Removing legacy columns or old MCP write paths.
- Pushing to GitHub or opening a PR.
