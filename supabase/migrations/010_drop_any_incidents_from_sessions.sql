-- Retire the legacy session incidents text field.
-- Incident links should use tracker_session_id and structured linked incident rows.

alter table drug_tracker_sessions
  drop column if exists any_incidents;
