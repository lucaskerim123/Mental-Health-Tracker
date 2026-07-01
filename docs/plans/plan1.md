# PLAN 2 — TRACKER / SESSION TRACKER

Main warning:
Be careful because the MCP connects with this. Do not randomly rename database tables, columns, or core meanings unless the MCP is updated at the same time. Keep current backend structure where possible and only add fields/features around it.

Main page/name change:
Change sidebar/nav label to:

Session Tracker

Do not change the database table name just because the UI name changes. Keep backend table as `drug_tracker_sessions` unless there is a separate approved database/MCP migration.

Session Tracker fields/sections:
1. Days since start — keep existing logic, do not change how days are counted, keep “Day X”.
2. Session end details — keep Close Session, add clearer closed details: started date, ended date, total days, final sleep total, linked incident count if available.
3. Sleep log — quick number entry for hours, keep existing sleep system, show sleep log list, total sleep hours, and time since last sleep. MCP must be able to create sleep entries the same way the app does.
4. Brief notes shorttextbox — viewer+, restrictable, lock button, if restricted show `Brief notes: REDACTED`.
5. Mood/feeling entries — quick entry system like sleep entry system, app create entry, MCP create entry, session_id, timestamp, hide if empty.
6. Usage log — quick entry system like sleep entry system, app create entry, MCP create entry, user note: i only use ice, default substance to “ice” or make it a simple preset, hide if empty, default visibility probably counsellor+ or admin only unless changed.
7. Notes — quick entry system for mcp commands, not one saved textbox. Saves a new log entry, connected to current session by `session_id`, app create entry, MCP create entry, hide if empty, restrictable if needed, if restricted show `Notes: REDACTED`.
8. Connected to any incidents — picker, uses existing incident `tracker_session_id`, allow linking existing incidents to current session, show linked incidents list, hide if empty, MCP must respect same link field.
9. Counsellor notes — textbox/note list, visible to counsellor + admin, lawyer visibility optional, hide if empty, if viewer cannot access show `Counsellor notes: REDACTED`.
10. Lawyer notes — textbox/note list, visible to lawyer + admin, counsellor visibility optional, hide if empty, if viewer cannot access show `Lawyer notes: REDACTED`.
11. Private Notes — textbox, visible to admin by default or counsellor/lawyer/admin if approved, hide if empty, if viewer cannot access show `Private Notes: REDACTED`.
12. Log entires (outputs from mcp) — down the bottom, read-only unless later approved, hide if empty, default visible to admin, can be counsellor+ if approved, if viewer cannot access show `Log entires (outputs from mcp): REDACTED`.

Session ID:
Every session must have an auto-created human-readable ID shown in every session view.

Display format:
Session #1
Session #2
Session #3

Where it must show:
- Session Tracker main page
- Session history
- Session detail page
- Session picker
- Incident session link picker
- Connected incidents section
- Log entires (outputs from mcp)
- Any MCP/log output that references the session

Edit rule:
- Cannot be edited.
- Auto-created by the system.
- Locked forever.
- Cannot be edited by viewer, counsellor, lawyer, admin, app, or MCP.

Backend rule:
- Do not replace the existing database `id`.
- Keep the existing internal database UUID for backend linking.
- Add a separate locked field such as `session_number`.
- Best display format: `Session #${session_number}`.

MCP rule:
- MCP can read and reference the session number.
- MCP must not edit the session number.
- User-facing MCP outputs should prefer `Session #1`, `Session #2`, etc.
- MCP can still use the internal database UUID for safe linking.

Notes quick entry:
The Notes section should support quick note, tracker update, mcp-created note, command output note, and session event note. Use existing `session_notes` if possible. Do not create a second note system unless needed.

Log entires (outputs from mcp):
Shows outputs created by mcp commands, command results, system-created tracker outputs, and mcp activity inside the session record. Display timestamp, source `mcp`, entry type if available, output text, related session, and related incident if linked.

Hide-if-empty rule:
Hide lower sections if there is no content: Usage log, Notes, Counsellor notes, Lawyer notes, Private Notes, Connected incidents, Mood/feeling entries, Log entires (outputs from mcp). Sleep log can show “No sleep entries” if useful.

Restricted field rule:
If a field has content but the user cannot view it, show the field and show REDACTED. Examples: Brief notes, Usage log, Notes, Counsellor notes, Lawyer notes, Private Notes, Log entires (outputs from mcp).

MCP compatibility rule:
Do not break the MCP by renaming existing tables or columns. Prefer adding fields/tables that the MCP can also use. The app should read from the same places the MCP writes to.

Keep existing likely tables:
`drug_tracker_sessions`, `sleep_log`, `drug_use_log`, `session_events`, `session_moods`, `session_notes`, `mental_health_incidents`.

Preferred backend shape:
Use or extend existing `session_events` / `session_notes` instead of creating too many new tables.

Possible fields:
`session_id`, `source = app or mcp`, `entry_type`, `content`, `metadata`, `created_at`, `visibility`.

Possible new fields on `drug_tracker_sessions`:
`brief_notes`, `counsellor_notes`, `lawyer_notes`, `field_visibility`.

Best long-term visibility option:
`field_visibility = {
  "brief_notes": "viewer+",
  "notes": "counsellor+",
  "usage_log": "counsellor+",
  "counsellor_notes": "counsellor+",
  "lawyer_notes": "lawyer+",
  "private_notes": "admin only",
  "mcp_outputs": "admin only"
}`

Placement on Session Tracker detail page:
Main session status; Sleep log; Brief notes; Mood/feeling entries; Usage log; Notes quick entry; Connected incidents; Counsellor notes; Lawyer notes; Private Notes; Log entires (outputs from mcp).

Implementation order:
Confirm current MCP table/field names before changing backend. Keep UI name change to “Session Tracker” only. Update session page layout. Add quick mood/feeling entry like sleep entry system. Add quick usage log entry, defaulting substance to “ice” if approved. Add brief notes with lock button. Change Notes into quick-entry/log style for app + MCP. Add connected incidents picker/list. Add counsellor notes, lawyer notes, private notes. Add Log entires (outputs from mcp) down the bottom. Add REDACTED display logic. Update MCP only after DB changes are final. Build/test. Only commit/PR after approval.

## Update notes — session tracker cleanup

*Skip if already done*

Session Tracker cleanup:
- Session details should stay near the top of the Session Tracker detail page.
- Log entires / session events are basically the same thing.
- Do not show duplicate log/session event sections unless there is a clear reason.
- MCP command outputs should go in the bottom log/output section.
- Normal notes, moods, usage, and sleep entries should stay in their proper entry sections.
- Remove `any_incidents` if it is still used anywhere.
- Incident connection should use `tracker_session_id` and linked incident lists, not a free-text `any_incidents` field.
- Mood entries, notes, usage entries, private notes, counsellor notes, lawyer notes, and MCP outputs need per-entry or per-field visibility where possible.
- Visibility options: viewer+ / counsellor+ / lawyer+ / admin only.
- Inputs need to be better structured where useful, not just basic/free-text fields.
