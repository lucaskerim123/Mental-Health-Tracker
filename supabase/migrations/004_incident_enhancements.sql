alter table mental_health_incidents
  add column if not exists police_called boolean not null default false,
  add column if not exists ambulance_called boolean not null default false,
  add column if not exists was_arrested boolean not null default false,
  add column if not exists was_sectioned boolean not null default false,
  add column if not exists people_involved text[] not null default '{}',
  add column if not exists tracker_session_id uuid references drug_tracker_sessions(id) on delete set null;
