# Plan 1 Incidents - Complete Implementation Plan

## Goal

Upgrade Incidents into structured incident records with:

- Locked human-readable incident numbers: `Incident #1`, `Incident #2`, etc.
- Field-by-field visibility controls.
- `REDACTED` display for protected values.
- New incident fields: location, outcome, professional note.
- Existing UUID `id` preserved for backend linking.
- MCP compatibility preserved.

## Non-Negotiables

- Do not replace `mental_health_incidents.id`.
- Do not rename existing tables or columns used by the app or MCP.
- Do not let app users or MCP edit `incident_number`.
- Do not leak restricted values in lists, previews, MCP outputs, or linked-record labels.
- Do not apply database changes until the SQL is reviewed.

## Schema

Schema draft file:

`docs/schema/plan-1-incidents-schema.sql`

Required additions to `mental_health_incidents`:

- `incident_number bigint not null unique`
- `location text`
- `outcome text`
- `professional_note text`
- `field_visibility jsonb not null default ...`

Default `field_visibility`:

```json
{
  "description": "viewer+",
  "notes": "viewer+",
  "personal_notes": "counsellor+",
  "professional_note": "counsellor+",
  "location": "viewer+",
  "people_involved": "viewer+",
  "outcome": "viewer+"
}
```

Incident numbering rules:

- Backfill existing incidents in stable order.
- Use a sequence for future incidents.
- Add a trigger to assign missing numbers on insert.
- Add a trigger to reject updates that change `incident_number`.

## TypeScript Types

Update `lib/supabase/types.ts`:

- Add role support later for `lawyer`; for now code should tolerate visibility value `lawyer+`.
- Extend `MentalHealthIncident` with:
  - `incident_number: number`
  - `location: string | null`
  - `outcome: string | null`
  - `professional_note: string | null`
  - `field_visibility: IncidentFieldVisibility`
- Add visibility types:
  - `type FieldVisibilityLevel = 'viewer+' | 'counsellor+' | 'lawyer+' | 'admin only'`
  - `type IncidentFieldKey = 'description' | 'notes' | 'personal_notes' | 'professional_note' | 'location' | 'people_involved' | 'outcome'`
  - `type IncidentFieldVisibility = Partial<Record<IncidentFieldKey, FieldVisibilityLevel>>`

## Visibility Logic

Create shared helpers, likely in `lib/incidents.ts` or `lib/visibility.ts`:

- `incidentLabel(incident)` -> `Incident #${incident.incident_number}`
- `canViewVisibilityLevel(role, level)`:
  - `viewer+`: viewer, counsellor, admin
  - `counsellor+`: counsellor, admin
  - `lawyer+`: admin until lawyer role exists, then lawyer/admin or lawyer/counsellor/admin if approved
  - `admin only`: admin
- `canViewIncidentField(profile.role, incident, field)`
- `redactIncidentForRole(incident, role)` for server-side safe objects.

Rules:

- Empty unrestricted field: hide.
- Empty restricted field: hide.
- Non-empty restricted field user cannot view: show field label and `REDACTED`.
- Non-empty allowed field: show actual value.
- Incident list previews must never include restricted content.

## New Incident Form

Update `app/incidents/new/NewIncidentForm.tsx`.

Fields:

- Date/time: `occurred_at`, required.
- Severity slider/number: `severity`, required.
- Police called: `police_called`.
- Arrested: `was_arrested`, only visible if `police_called`.
- Ambulance called: `ambulance_called`.
- Sectioned: `was_sectioned`, only visible if `ambulance_called`.
- Location: `location`, restrictable.
- Who was involved: `people_involved`, restrictable.
- Session link: `tracker_session_id`, default active session if available.
- Incident details: `description`, restrictable.
- Notes: `notes`, restrictable.
- Private notes: `personal_notes`, default `counsellor+`.
- Note for counsellor or lawyer: `professional_note`, default `counsellor+`.
- Outcome: `outcome`, restrictable.

Lock controls:

- Show lock button beside every restrictable field.
- When clicked, allow selecting:
  - viewer+
  - counsellor+
  - lawyer+
  - admin only
- Store selected values in `field_visibility`.

Insert payload:

- Include all new fields.
- Include `field_visibility`.
- Do not include `incident_number`.

## Edit / Detail Page

Update:

- `app/incidents/[id]/page.tsx`
- `app/incidents/[id]/IncidentDetail.tsx`

Required behavior:

- Header shows `Incident #`.
- Read view sections:
  - Status/severity/date
  - Incident details
  - Location
  - Who was involved
  - Police called / Arrested
  - Ambulance called / Sectioned
  - Linked session
  - Notes
  - Private notes
  - Note for counsellor or lawyer
  - Outcome
- Edit mode supports all new fields.
- Edit mode supports lock controls.
- Update payload includes new fields and `field_visibility`.
- Update payload must never include `incident_number`.

Server safety:

- Page must redact before passing data to client where practical.
- Client should also use display helpers to avoid accidental leaks.

## Incident List Page

Update `app/incidents/page.tsx`.

List cards/rows show:

- `Incident #`
- Date/time
- Severity
- Allowed incident details or `REDACTED`
- Police/ambulance/arrested/sectioned flags
- Linked `Session #` if available later; UUID display is acceptable only until session numbering is implemented.

Do not show:

- Restricted notes.
- Restricted private notes.
- Restricted details in previews.

## Dashboard / Linked Views

Check and update:

- `app/dashboard/page.tsx`
- `app/tracker/[id]/page.tsx`
- `app/tracker/[id]/TrackerDetail.tsx`
- any incident picker/dropdown.

Requirements:

- Prefer `Incident #` over UUID in user-facing labels.
- Linked incident sections show `Incident #`.
- Restricted incident preview values are `REDACTED`.

## Activity Logging

Where incident creates/updates/deletes already log activity, include:

- `incident_number`
- changed high-level fields
- avoid logging restricted values in activity metadata unless admin-only.

## Tests / Verification

Run:

```powershell
npm run build
```

Manual checks:

- Admin can create full incident.
- Viewer sees unrestricted values.
- Viewer sees `REDACTED` for restricted non-empty fields.
- Empty restricted fields are hidden.
- Incident list does not leak restricted preview text.
- Detail page shows `Incident #`.
- Edit form cannot change `incident_number`.
Database checks after applying SQL:

- Existing incidents have sequential `incident_number`.
- New incidents get a number.
- Updating `incident_number` fails.
- Inserts from the app succeed without specifying `incident_number`.

## Implementation Order

1. Review `docs/schema/plan-1-incidents-schema.sql`.
2. Apply schema to Supabase when approved.
3. Update TypeScript types.
4. Add shared incident label and visibility helpers.
5. Update new incident form.
6. Update incident detail/edit page.
7. Update incident list page.
8. Update mobile incident pages.
9. Update dashboard and linked incident displays.
10. Run build and manual checks.
11. Commit on `website-work`.
12. Push to `origin/website-work`.
13. Open PR only after approval.
