# PLAN 1 - INCIDENTS

Main idea:
The Incidents page becomes a structured incident record with field-by-field access control. Some fields can be viewed by viewer, some only by counsellor+, some only by lawyer+, some only by admin+. If a viewer sees a restricted field, the field still shows, but the value says:

REDACTED

Incident fields:
1. Date/time - date/time picker, `occurred_at`, viewer+, required.
2. Serverity / Severity - number or slider 1-10, `severity`, viewer+, required.
3. Police called - yes/no toggle, `police_called`, viewer+.
4. Arrested? - yes/no toggle, `was_arrested`, only shows if Police called = yes.
5. Ambulance called - yes/no toggle, `ambulance_called`, viewer+.
6. Sectioned? - yes/no toggle, `was_sectioned`, only shows if Ambulance called = yes.
7. Location - textbox, new field `location`, restrictable, lock button, default viewer+, if restricted show `Location: REDACTED`.
8. Who was involved - tag/comma names, `people_involved`, restrictable, lock button, default viewer+, if restricted show `Who was involved: REDACTED`.
9. Session link - picker/dropdown, `tracker_session_id`, active session auto-select if open, viewer+.
10. Incident details - large textbox, `description`, restrictable, lock button, access options viewer+ / counsellor+ / lawyer+ / admin only, if restricted show `Incident details: REDACTED`.
11. Notes - large textbox, `notes`, restrictable, lock button, if restricted show `Notes: REDACTED`.
12. Private Notes - large textbox, `personal_notes`, restrictable, lock button, default counsellor + lawyer + admin, if viewer cannot access show `Private Notes: REDACTED`.
13. Note for counsellor or Lawyer - large textbox, new field `professional_note` or `counsellor_lawyer_note`, restrictable, lock button, default counsellor + lawyer + admin, if viewer cannot access show `Note for counsellor or Lawyer: REDACTED`.
14. What's outcome - textbox or dropdown + textbox, new field `outcome`, restrictable, lock button, default viewer+, hide if empty, if restricted show `What's outcome: REDACTED`.

Incident page ID:
Every incident must have an auto-created human-readable ID shown in every incident view.

Display format:
Incident #1
Incident #2
Incident #3

Where it must show:
- Incident list page
- Incident detail page
- Add/edit incident success state if needed
- Linked incident picker
- Connected incidents inside Session Tracker
- Any MCP/log output that references the incident

Edit rule:
- Cannot be edited.
- Auto-created by the system.
- Locked forever.
- Cannot be edited by viewer, counsellor, lawyer, admin, app, or MCP.

Backend rule:
- Do not replace the existing database `id`.
- Keep the existing internal database UUID for backend linking.
- Add a separate locked field such as `incident_number`.
- Best display format: `Incident #${incident_number}`.

MCP rule:
- MCP can read and reference the incident number.
- MCP must not edit the incident number.
- User-facing MCP outputs should prefer `Incident #1`, `Incident #2`, etc.
- MCP can still use the internal database UUID for safe linking.

Lock button behaviour:
Show a small lock button beside every restrictable field: Location, Who was involved, Incident details, Notes, Private Notes, Note for counsellor or Lawyer, and What's outcome. Unlocked means normal default visibility. Locked means restricted based on selected access level: viewer+, counsellor+, lawyer+, admin only.

Empty/restricted rules:
If a field is empty and not restricted, hide it. If a field has content but the user cannot view it, show the field and say REDACTED. If admin/counsellor/lawyer is allowed, show the actual content. If a field is restricted but empty, do not show fake REDACTED unless there is actual content to protect.

Incident list page:
Show date/time, severity, allowed incident details or REDACTED, police/ambulance/arrested/sectioned flags, and linked session if one exists. Do not leak restricted notes or restricted details in previews.

Incident detail page sections:
Incident status / severity / date; Incident details; Location; Who was involved; Police called / Arrested?; Ambulance called / Sectioned?; Linked session; Notes; Private Notes; Note for counsellor or Lawyer; What's outcome.

Database changes likely needed:
Add `location`, `outcome`, `professional_note` or `counsellor_lawyer_note`, lawyer role later, and field-level visibility control. Best long-term option is one JSON field:

`field_visibility = {
  "description": "counsellor+",
  "notes": "admin only",
  "personal_notes": "counsellor+",
  "professional_note": "lawyer+",
  "location": "viewer+",
  "people_involved": "viewer+",
  "outcome": "viewer+"
}`

Implementation order:
Update incident data model/types. Add DB fields for location, outcome, professional note, and field visibility. Add lawyer role later when role rules are final. Update Add Incident form with lock buttons. Update Incident Detail page with REDACTED behaviour. Update Incident List page so restricted previews show REDACTED and never leak content. Build/test. Only commit/PR after approval.
