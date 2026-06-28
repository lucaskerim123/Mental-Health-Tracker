# PLAN 4 - DOCUMENTS / ATTACHMENTS

Main idea:
Documents should be a master file system with sub-links to incidents, sessions, and other records. Do not duplicate the same file if it gets attached to more than one incident or session.

Core rule:
Upload goes to the Document page first as the master record, then that master document can be linked to other things.

Order:
1. Upload to Document page = master document record.
2. Link that document to Incident #, Session #, or other records.
3. If the same file is attached somewhere else later, reuse the master document instead of uploading a duplicate.

Upload locations:
Files should be uploadable from:
- Document page
- Incident page
- Session Tracker page

But even if uploaded from Incident or Session, the backend should still create one master document record first, then create a link between that document and the incident/session.

Document page behaviour:
- Document page is the master list.
- It should show each unique file once.
- It should show what the file is linked to.
- Example:
  - `File A.pdf`
  - Linked to: Incident #1, Incident #4, Session #2
- Do not show duplicate rows for the same uploaded file.

Duplicate file rule:
If I upload the same file to different incidents, do not duplicate the file on the document page.

Use duplicate detection:
- Check file hash if possible.
- Also compare filename + size + uploaded_by if needed.
- If duplicate is detected, reuse the existing document record.
- Create a new link only.

Recommended backend shape:
Keep master document table:
- `documents`
  - `id`
  - `document_number`
  - `filename`
  - `storage_path`
  - `mime_type`
  - `file_hash`
  - `size_bytes`
  - `uploaded_by`
  - `is_sensitive`
  - `allowed_user_ids`
  - `created_at`

Add document link table:
- `document_links`
  - `id`
  - `document_id`
  - `linked_type`
  - `linked_id`
  - `created_at`

Linked type examples:
- `incident`
- `tracker_session`
- `user`
- `none`

Display ID:
Every document should have a locked human-readable ID.

Display format:
Document #1
Document #2
Document #3

Edit rule:
- Document number cannot be edited.
- Keep internal database UUID for backend linking.
- User-facing app and MCP outputs should prefer `Document #1`.

Incident page:
- Add "Attached Documents" section.
- Hide if empty.
- If documents exist, show linked master documents.
- If viewer cannot access a restricted document, show:

Document #1: REDACTED

Session Tracker page:
- Add "Attached Documents" section.
- Hide if empty.
- If documents exist, show linked master documents.
- If viewer cannot access a restricted document, show:

Document #1: REDACTED

Access/restriction:
Documents should follow the same REDACTED rule as Incidents and Session Tracker.
If a document exists but user cannot view it, show the row but say REDACTED.

Upload form fields:
- File
- Title / filename
- Notes
- Link to incident picker
- Link to session picker
- Sensitive toggle / lock
- Visibility:
  - viewer+
  - counsellor+
  - lawyer+
  - admin only

MCP rule:
MCP can attach existing documents to incidents/sessions.
MCP should not duplicate files.
MCP should use the master document record and create links.
MCP outputs should say:
- `Document #1 linked to Incident #2`
- `Document #1 linked to Session #3`

Implementation order:
1. Keep or update `documents` as master document table.
2. Add `document_number`.
3. Add `file_hash` and `size_bytes` for duplicate detection.
4. Add `document_links` table.
5. Update upload flow so every upload creates/reuses a master document.
6. Update Incident page to link/display attached documents.
7. Update Session Tracker page to link/display attached documents.
8. Update Document page to show unique master documents and all linked records.
9. Add REDACTED behaviour.
10. Update MCP document attach commands later if needed.

Clean rule:
Document page is master. Incidents and Sessions only link to documents. Same file uploaded twice = one master document, multiple links.
