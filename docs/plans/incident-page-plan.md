**PLAN 1 — INCIDENTS / INCIDENT PAGE**

**Main idea:**

The Incidents page should be its own structured record system with proper field separation, its own report/export system, redaction support, and front-card-safe preview content.

**Main warning:**

Be careful because the MCP connects with this. Do not randomly rename database tables, columns, or core meanings unless the MCP is updated at the same time. Keep current backend structure where possible and only add fields/features around it.

**Core page rule:**

Do not make the Incident page just a copy of Session Tracker. Keep Incident page as its own page and its own record type.

**Main issue shown by Incident #5:**

The current incident structure is mixing instructions with real content.

**That needs to be cleaned up by separating:**

- front card / preview content

- detailed incident content

- private notes

- professional notes

- export/report output

**Front card / preview rule:**

Incident cards or preview rows need their own safe summary source.

Do not pull full incident details straight into the front card by default.

Do not show content on the front card that was meant to stay inside the full Incident page.

**Add:**

- `brief_summary` or `front_card_summary`

This should be short, safe preview content for cards/lists.

This is where “brief incident details” belongs if needed.

**Detailed incident content:**

Keep full incident content in its own proper field/section.

**Use:**

- `description` or `detailed_incident_details`

This is the main full incident narrative shown on the Incident page and in Incident export when allowed.

Do not use `private_notes` as a placeholder instruction area for detailed incident content long term.

**Field structure:**

1.  Date/time — date/time picker, `occurred_at`, viewer+, required.

2.  Severity — number or slider 1–10, `severity`, viewer+, required.

3.  Substance use — yes/no or controlled field, `substance_use`, viewer+.

4.  Police called — yes/no toggle, `police_called`, viewer+.

5.  Arrested — yes/no toggle, `was_arrested`, only shows if Police called = yes.

6.  Ambulance called — yes/no toggle, `ambulance_called`, viewer+.

7.  Sectioned — yes/no toggle, `was_sectioned`, only shows if Ambulance called = yes.

8.  Front card summary / brief summary — short text, restrictable if needed, used for cards/lists only, do not auto-use full details here.

9.  Detailed Incident Details — large textbox, main incident narrative, restrictable, not for front card.

10. Location — textbox, restrictable, lock button.

11. Who was involved — tags / names list, restrictable, lock button.

12. Session link — picker/dropdown, `tracker_session_id`, active session auto-select if open, viewer+.

13. Notes — general incident notes, separate from detailed incident field.

14. Private Notes — not for public/general display, stricter visibility by default.

15. Note for counsellor and Lawyer — rename from `or` to `and`, separate professional field.

16. What’s outcome — textbox or dropdown + textbox.

17. Attached Documents — linked master documents section.

18. Incident report/export action.

**Label fix:**

**Change:**

`Note for counsellor or Lawyer`

**to:**

`Note for counsellor and Lawyer`

**Permission/default visibility fix:**

The example incident shows the current behavior is too open.

**Use stricter defaults:**

- `brief_summary`: viewer+ only if intended for preview

- `detailed_incident_details`: viewer+ unless manually restricted

- `location`: viewer+

- `people_involved`: viewer+

- `notes`: viewer+ or counsellor+ depending on your final rule

- `outcome`: viewer+

- `private_notes`: counsellor+ / lawyer+ / admin, or admin only if approved

- `note_for_counsellor_and_lawyer`: lawyer+ by default

- attached documents follow document-level visibility

**The important fix:**

`note_for_counsellor_and_lawyer` should default to `lawyer+`

not `viewer+`.

**Restricted field rule:**

**If a field has content but the current viewer cannot access it, still show the field label and show:**

`REDACTED`

**Sensitive rule:**

**If a page, field, section, entry, or document is marked sensitive:**

- show the field/section/document still

- do not just hide it

- use `fancyredact` wherever possible

- if `fancyredact` is not available, use a basic redact display instead

- make it obvious and intentional, not like missing data

**Important distinction:**

- restricted = permission-based `REDACTED`

- sensitive = `fancyredact` wherever possible, fallback redact if needed

**Attached documents:**

Add `Attached Documents` section to Incident page.

- hide if empty

- reuse linked master documents

- do not duplicate stored files

- if a document is restricted, show `Document #X: REDACTED`

- if a document is sensitive, show it redacted with `fancyredact` wherever possible

**Incident ID:**

Every incident must have an auto-created human-readable ID shown everywhere.

**Display format:**

Incident #1

Incident #2

Incident #3

**Where it must show:**

- Incident list

- Incident detail page

- Incident picker

- Linked incident references

- Session-linked incident area

- Attached document area if shown

- Incident report/export

- MCP/log output referencing the incident

**Edit rule:**

- cannot be edited

- auto-created by the system

- locked forever

- not editable by viewer, counsellor, lawyer, admin, app, or MCP

**Backend rule:**

- do not replace existing database `id`

- keep internal UUID for linking

- add or keep locked `incident_number`

- display as `Incident #\${session_number}`

**Preferred backend shape:**

Keep using `mental_health_incidents` unless there is a separately approved migration.

Prefer extending current structure instead of rebuilding it.

**Suggested fields:**

- `incident_number`

- `occurred_at`

- `severity`

- `substance_use`

- `police_called`

- `was_arrested`

- `ambulance_called`

- `was_sectioned`

- `front_card_summary`

- `description` or `detailed_incident_details`

- `location`

- `people_involved`

- `tracker_session_id`

- `notes`

- `outcome`

- `professional_note`

- `personal_notes`

- `field_visibility`

- `sensitive_fields`

- `is_sensitive`

**Incident page layout:**

**Use this order:**

- Incident header / Incident #

- occurred date/time

- severity / tags row

- front card summary should not appear as the full detail section unless you want it shown there too

- Detailed Incident Details

- location

- who was involved

- emergency services area

- notes

- what’s outcome

- session link

- attached documents

- Note for counsellor and Lawyer

- Private Notes

**Own report/export system:**

This is a required addition.

The Incident page needs its own report/export system.

Do not rely on Session Tracker export for this.

**Incident report/export rule:**

- generate export for a single incident

- keep it incident-specific

- respect permissions

- respect sensitive handling

- support PDF/export properly

- keep layout readable even when fields are redacted

**Incident export should include when allowed:**

- Incident #

- date/time

- severity

- substance use

- police / arrested

- ambulance / sectioned

- location

- who was involved

- front card summary if you want it included

- Detailed Incident Details

- notes

- outcome

- linked Session #

- attached documents list

- Note for counsellor and Lawyer

- Private Notes

**Incident export behavior:**

- keep headings/labels visible

- if empty, section can stay hidden

- if permission blocks content, show `REDACTED`

- if sensitive, use `fancyredact` wherever possible

- if `fancyredact` not available, basic redact fallback

- do not leave selectable/searchable text under redaction

- final PDF/export must only contain allowed or redacted output

**What this proves needs changing:**

- front card preview content needs its own field

- full incident narrative needs its own field

- do not store workflow instructions inside live user-facing content fields long term

- rename `Note for counsellor or Lawyer` to `Note for counsellor and Lawyer`

- set that field to `Lawyer+` by default

- tighten `private_notes` default visibility

- do not show full details on front cards unless explicitly intended

- make export/redaction behavior incident-specific

**Implementation order:**

10. Confirm current incident table/field names.

11. Keep Incident page as its own record type.

12. Add or confirm locked `incident_number`.

13. Add `front_card_summary` / `brief_summary` field.

14. Keep full detailed incident content in its own field.

15. Rename professional field to `Note for counsellor and Lawyer`.

16. Change default permission for that field to `Lawyer+`.

17. Tighten `private_notes` default visibility.

18. Add proper REDACTED behavior for restricted content.

10. Add `fancyredact` wherever possible for sensitive content.

11. Add `Attached Documents` section with permission/redaction logic.

12. Build Incident page’s own report/export system.

13. Make export respect permissions and redaction.

14. Make sure front card uses the safe summary field, not the detailed field.

15. Build/test.

16. Only commit/PR after approval.
