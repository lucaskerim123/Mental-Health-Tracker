# PLAN 3 - MCP COMMANDS

Main idea:
Use the current MCP command list as the base, then fix/change/add what is needed so the MCP works properly with Plan 1 Incidents and Plan 2 Session Tracker. The MCP must use the same backend tables/fields as the app. Do not create a second tracker system.

Main MCP rules:
- MCP must respect the existing app structure.
- MCP must work with `drug_tracker_sessions`, `sleep_log`, `drug_use_log`, `session_moods`, `session_notes`, `session_events`, and `mental_health_incidents`.
- MCP must use internal database UUIDs for safe linking.
- MCP user-facing outputs should show locked human IDs like `Session #1` and `Incident #1`.
- MCP must not edit `session_number` or `incident_number`.
- MCP outputs should appear down the bottom of the Session Tracker page under:

Log entires (outputs from mcp)

- MCP-created notes and command outputs should include source = `mcp`.
- MCP should not bypass REDACTED / visibility rules.

SESSION COMMANDS

1. Start session aliases

Use:
- `/cloudseshstart`
- `/cloudsesh`
- `/startsesh`
- `/startcloud`

Do not use:
- `/cloudsessionstart`

Natural phrasing:
- "Start a new session"

Plan:
- `/cloudseshstart`, `/startsesh`, and `/startcloud` are force start commands.
- Allow optional date:
  - `/cloudseshstart date=2026-06-28`
  - `/startsesh date=2026-06-28`
  - `/startcloud date=2026-06-28`
- If no date is supplied, use today.
- If there is already an open session, reject the command and return the custom duplicate start error.
- Do not create duplicate open sessions.
- Output should include Session #.
- Internal UUID stays hidden unless debug/admin mode.

Session start output:
When session start is triggered by MCP/mco and the session successfully starts, output this:

Here we Go ya dropkick Session ## has now started

Rules:
- Replace `##` with the actual session number.
- Example: `Here we Go ya dropkick Session #1 has now started`
- Only use this after the session is successfully created.
- Do not use this if a session is already open. Use the duplicate start custom error instead.

2. Stop session aliases

Use:
- `/cloudseshstop`
- `/cloudsesh`
- `/stopsesh`
- `/stopcloud`

Also accept typo alias if needed:
- `/stopclould`

Natural phrasing:
- "Stop the session and save it"

Plan:
- `/cloudseshstop`, `/stopsesh`, and `/stopcloud` force stop-preview behaviour by default.
- `/stopsesh confirm=true`, `/cloudseshstop confirm=true`, or `/stopcloud confirm=true` stops and saves immediately.
- Do not close the session without confirm=true unless the user natural language clearly says "stop the session and save it".
- If there is no open session, return a custom no-session error.
- Save:
  - `date_end`
  - optional end note
  - optional outcome later if added

Session end output:
When the session is stopped/saved successfully, output this:

Hope this comedown is a real big ass kicker you deserve it

Rules:
- Only use this after the session is actually stopped and saved.
- Do not use this for stop preview.
- Do not use this if stopping fails.
- `/cloudsesh` third press, `/stopsesh confirm=true`, `/cloudseshstop confirm=true`, and `/stopcloud confirm=true` can trigger this after successful save.

3. `/cloudsesh` smart 3 time button rule

`/cloudsesh` acts like a smart button depending on current session state.

Step 1:
If user enters `/cloudsesh` and there is no open session, it starts a new session.

Output:
`Here we Go ya dropkick Session ## has now started`

Step 2:
If user enters `/cloudsesh` again and there is already an open session, it previews stopping the session.

Output should show:
- Session #
- days since start
- sleep total
- mood entries count
- usage entries count
- linked incidents count
- message saying run `/cloudsesh` again to confirm/save, or use `/stopsesh confirm=true`

Step 3:
If user enters `/cloudsesh` a third time after the stop preview, it confirms and saves/stops the session.

Output:
`Hope this comedown is a real big ass kicker you deserve it`

Safe behaviour:
- `/cloudsesh` is the only 3-step smart button command.
- MCP must track pending stop confirmation so the third `/cloudsesh` knows it should save/stop, not just preview again.
- If confirmation state expires or is cleared, `/cloudsesh` goes back to normal smart behaviour.
- `/cloudsesh` is excluded from duplicate start rejection because if a session is already open, `/cloudsesh` moves to stop preview instead of rejecting.

4. Duplicate start error rule

If a session is already started/open, these commands must not create another session:
- `/cloudseshstart`
- `/startsesh`
- `/startcloud`

Instead, reject the command and output this custom error exactly:

Session already started: Session ## is currently open.

Are you that fucking high your doubling up huh?  
Well sorry bud I can't do that bloody junkie

Rules:
- Replace `##` with the actual session number.
- Keep the line break after the first sentence.
- Do not create duplicate open sessions.
- Do not overwrite the current session.
- Do not silently switch sessions.
- Return the existing open session number in the error.
- `/cloudsesh` is excluded because it is the smart 3-step button.

5. Current session info

Command:
- `/seshinfo`

Natural phrasing:
- "Show me the current session"

Plan:
- Keep `/seshinfo`.
- Shows active session only.
- Output:
  - Session #
  - date started
  - days since start
  - sleep total
  - time since last sleep
  - latest mood
  - usage summary
  - linked incidents
  - brief notes if allowed
  - REDACTED where restricted

6. List recent sessions

Command:
- `/seshlist`
- `/seshlist 10`

Plan:
- Keep `/seshlist`.
- Support optional number:
  - `/seshlist 10`
- Default to 10 if no number supplied.
- Output should show:
  - Session #
  - start date
  - end date or open
  - total days
  - sleep total
  - incident count

7. Full export of a session

Command:
- `/seshexport`
- `/seshexport <id>`

Plan:
- Keep `/seshexport`.
- Allow:
  - `/seshexport`
  - exports current session if one is active
  - `/seshexport Session #1`
  - `/seshexport <uuid>`
- Export should include:
  - session details
  - sleep log
  - mood/feeling entries
  - usage log
  - notes
  - linked incidents
  - Log entires (outputs from mcp)
- Must respect role visibility unless admin export mode is approved.

ENTRY LOGGING COMMANDS

8. Log sleep

Command:
- `/addsleep hrs`

Natural phrasing:
- "Log that I slept 6 hours"

Plan:
- Keep `/addsleep`.
- Better command format:
  - `/addsleep 6`
  - `/addsleep hrs=6`
- Creates sleep log entry linked to active session.
- Updates total sleep on session if current app still stores total sleep on `drug_tracker_sessions`.
- Output:
  - `Added 6h sleep to Session #1`
  - updated total
  - time since last sleep reset
- If no active session and no session ID supplied, reject with clear error.

9. Log mood

Command:
- `/moodadd *match mood entry system*`

Natural phrasing:
- "Add mood: calm and grounded"

Plan:
- Keep `/moodadd`.
- Format:
  - `/moodadd calm and grounded`
  - `/moodadd mood="calm and grounded"`
- Must match the app mood/feeling entry system.
- Creates entry in `session_moods`.
- Links to active session.
- Output:
  - `Mood added to Session #1`

10. Add a note

Command:
- `/addnote Using last of supply, heading home`

Natural phrasing:
- "Note: took a break, feeling better"

Plan:
- Keep `/addnote`.
- Notes should be quick entries, not one overwritten textbox.
- Save to `session_notes` if possible.
- Add:
  - source = `mcp`
  - entry_type = `note`
  - content
  - session_id
  - created_at
- Output:
  - `Note added to Session #1`
- Notes should show in Session Tracker under Notes quick entry.
- MCP outputs/results should show under Log entires if they are command/system output, not normal notes.

11. Log substance use

Command:
- `/loguse ice 0.1 p`

Natural phrasing:
- "Log 2 p ice smoke"

Plan:
- Keep `/loguse`.
- User note: i only use ice.
- App/MCP can default substance to `ice`.
- Supported formats:
  - `/loguse ice 0.1 p`
  - `/loguse 0.1 p`
  - `/loguse ice amount=0.1 unit=p`
  - natural: "Log 2 p ice smoke"
- Save to `drug_use_log`.
- Fields:
  - session_id
  - substance = ice
  - amount
  - unit
  - notes
  - logged_at
- Output:
  - `Usage logged to Session #1`
- Visibility should default counsellor+ or admin only unless changed.

12. View substance history

Command:
- `/usehistory`
- `/usehistory <session-id>`

Plan:
- Keep `/usehistory`.
- If no ID supplied, show current session usage history.
- Accept:
  - `/usehistory`
  - `/usehistory Session #1`
  - `/usehistory <uuid>`
- Output:
  - Session #
  - date/time
  - substance
  - amount/unit
  - notes if allowed
- Respect visibility. Viewer should see REDACTED if restricted.

INCIDENT COMMANDS

13. Log an incident

Command:
`/createincident severity=7 description="Panic attack at train station" personal_notes="..." police_called=false ambulance_called=true link_session=true`

Natural phrasing:
- "Create an incident, severity 5, description was a rough comedown, ambulance not called"

Plan:
- Keep `/createincident`.
- Must create record in `mental_health_incidents`.
- Must support Plan 1 fields:
  - date/time
  - severity
  - police_called
  - was_arrested if police_called = true
  - ambulance_called
  - was_sectioned if ambulance_called = true
  - location
  - people_involved
  - tracker_session_id / link_session
  - description
  - notes
  - personal_notes
  - professional_note or counsellor_lawyer_note
  - outcome
  - field_visibility
- If `link_session=true`, link to active session.
- If user supplies `Session #1`, resolve to internal UUID.
- Output:
  - `Incident #1 created`
  - linked session if any
  - police/ambulance flags
  - restricted fields should not leak to viewer

Suggested command format:
`/createincident severity=7 description="Panic attack at train station" personal_notes="..." police_called=false ambulance_called=true link_session=true`

Optional expanded format:
`/createincident severity=7 description="..." location="Train station" people="Name 1, Name 2" police_called=false ambulance_called=true was_sectioned=false link_session=true outcome="Calmed down and left"`

NATURAL PHRASES TO SUPPORT

- "Start a new session"
- "Log that I slept 6 hours"
- "Add mood: calm and grounded"
- "Note: took a break, feeling better"
- "Log 2 p ice smoke"
- "Stop the session and save it"
- "Show me the current session"
- "Create an incident, severity 5, description was a rough comedown, ambulance not called"

CHANGES TO MAKE IT BETTER

1. Keep command aliases, but make one main command for each action.
- Main smart command: `/cloudsesh`
- Main start: `/cloudseshstart`
- Main stop: `/cloudseshstop`
- Main info: `/seshinfo`
- Main list: `/seshlist`
- Main export: `/seshexport`
- Main note: `/addnote`
- Main incident: `/createincident`

2. Remove `/cloudsessionstart`.
Do not use this command.

3. Use confirm=true for final stop actions.
- `/stopsesh` previews.
- `/stopsesh confirm=true` closes and saves.
- `/cloudseshstop confirm=true` closes and saves.
- `/stopcloud confirm=true` closes and saves.

4. Add ID lookup support.
MCP should accept:
- `Session #1`
- `Incident #1`
- internal UUID
- current active session when no ID supplied

5. Add source tracking.
Every MCP-created record should include:
- source = `mcp`
- entry_type
- created_at
- session_id if relevant
- incident_id if relevant

6. Add Log entires support.
Every MCP command output that should be kept should write a readable output entry to:

Log entires (outputs from mcp)

7. Add REDACTED support.
MCP must not expose fields hidden by field visibility. If restricted, return:

REDACTED

8. Add duplicate protection.
- Do not start a new session if one is already open.
- Do not stop a session twice.
- Do not create sleep/mood/usage/note entries if there is no active session unless a session ID is supplied.

9. Add clear error messages.
Examples:
- `No active session found. Start one with /cloudseshstart.`
- `Session already started: Session #1 is currently open.`
- `Cannot stop session without confirm=true.`
- `Could not find Incident #4.`
- `Could not find Session #2.`

10. Keep MCP synced with app.
The MCP should create entries that the app can immediately show in:
- Session Tracker
- Notes
- Mood/feeling entries
- Usage log
- Sleep log
- Connected incidents
- Log entires (outputs from mcp)
- Incidents
