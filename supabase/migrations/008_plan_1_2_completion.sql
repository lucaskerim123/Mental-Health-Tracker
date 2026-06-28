-- Plan 1 + Plan 2 completion.
-- Adds locked human-readable numbers, field visibility, session log tables,
-- and the missing structured incident/session fields.

alter table mental_health_incidents
  add column if not exists incident_number bigint,
  add column if not exists location text,
  add column if not exists outcome text,
  add column if not exists professional_note text,
  add column if not exists field_visibility jsonb not null default '{
    "description": "viewer+",
    "notes": "viewer+",
    "personal_notes": "counsellor+",
    "professional_note": "counsellor+",
    "location": "viewer+",
    "people_involved": "viewer+",
    "outcome": "viewer+"
  }'::jsonb;

create sequence if not exists mental_health_incident_number_seq;

with numbered as (
  select id, row_number() over (order by occurred_at, created_at, id) as rn
  from mental_health_incidents
  where incident_number is null
)
update mental_health_incidents i
set incident_number = numbered.rn
from numbered
where i.id = numbered.id;

select setval(
  'mental_health_incident_number_seq',
  greatest(coalesce((select max(incident_number) from mental_health_incidents), 0), 1),
  true
);

alter table mental_health_incidents
  alter column incident_number set default nextval('mental_health_incident_number_seq'),
  alter column incident_number set not null;

create unique index if not exists mental_health_incidents_incident_number_key
  on mental_health_incidents (incident_number);

create or replace function set_incident_number()
returns trigger language plpgsql as $$
begin
  if new.incident_number is null then
    new.incident_number := nextval('mental_health_incident_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists mental_health_incidents_set_incident_number on mental_health_incidents;
create trigger mental_health_incidents_set_incident_number
  before insert on mental_health_incidents
  for each row execute function set_incident_number();

create or replace function reject_incident_number_update()
returns trigger language plpgsql as $$
begin
  if old.incident_number is distinct from new.incident_number then
    raise exception 'incident_number is locked and cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists mental_health_incidents_reject_incident_number_update on mental_health_incidents;
create trigger mental_health_incidents_reject_incident_number_update
  before update on mental_health_incidents
  for each row execute function reject_incident_number_update();

alter table drug_tracker_sessions
  add column if not exists session_number bigint,
  add column if not exists brief_notes text,
  add column if not exists counsellor_notes text,
  add column if not exists lawyer_notes text,
  add column if not exists field_visibility jsonb not null default '{
    "brief_notes": "viewer+",
    "notes": "counsellor+",
    "usage_log": "counsellor+",
    "counsellor_notes": "counsellor+",
    "lawyer_notes": "lawyer+",
    "private_notes": "admin only",
    "mcp_outputs": "admin only"
  }'::jsonb;

create sequence if not exists drug_tracker_session_number_seq;

with numbered as (
  select id, row_number() over (order by created_at, date_start, id) as rn
  from drug_tracker_sessions
  where session_number is null
)
update drug_tracker_sessions s
set session_number = numbered.rn
from numbered
where s.id = numbered.id;

select setval(
  'drug_tracker_session_number_seq',
  greatest(coalesce((select max(session_number) from drug_tracker_sessions), 0), 1),
  true
);

alter table drug_tracker_sessions
  alter column session_number set default nextval('drug_tracker_session_number_seq'),
  alter column session_number set not null;

create unique index if not exists drug_tracker_sessions_session_number_key
  on drug_tracker_sessions (session_number);

create or replace function set_session_number()
returns trigger language plpgsql as $$
begin
  if new.session_number is null then
    new.session_number := nextval('drug_tracker_session_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists drug_tracker_sessions_set_session_number on drug_tracker_sessions;
create trigger drug_tracker_sessions_set_session_number
  before insert on drug_tracker_sessions
  for each row execute function set_session_number();

create or replace function reject_session_number_update()
returns trigger language plpgsql as $$
begin
  if old.session_number is distinct from new.session_number then
    raise exception 'session_number is locked and cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists drug_tracker_sessions_reject_session_number_update on drug_tracker_sessions;
create trigger drug_tracker_sessions_reject_session_number_update
  before update on drug_tracker_sessions
  for each row execute function reject_session_number_update();

create table if not exists session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references drug_tracker_sessions(id) on delete cascade,
  event_type text not null,
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists session_moods (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references drug_tracker_sessions(id) on delete cascade,
  mood text not null,
  notes text,
  source text not null default 'app',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references drug_tracker_sessions(id) on delete cascade,
  note text not null,
  entry_type text not null default 'note',
  source text not null default 'app',
  metadata jsonb not null default '{}'::jsonb,
  visibility text not null default 'counsellor+',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table tracker_entries
  add column if not exists entry_type text not null default 'entry',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists visibility text not null default 'admin only',
  add column if not exists incident_id uuid references mental_health_incidents(id) on delete set null;

alter table session_events enable row level security;
alter table session_moods enable row level security;
alter table session_notes enable row level security;

drop policy if exists "session_events_admin_all" on session_events;
create policy "session_events_admin_all" on session_events
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "session_events_counsellor_read" on session_events;
create policy "session_events_counsellor_read" on session_events
  for select
  using (current_user_role() = 'counsellor');

drop policy if exists "session_moods_admin_all" on session_moods;
create policy "session_moods_admin_all" on session_moods
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "session_moods_counsellor_read" on session_moods;
create policy "session_moods_counsellor_read" on session_moods
  for select
  using (current_user_role() = 'counsellor');

drop policy if exists "session_notes_admin_all" on session_notes;
create policy "session_notes_admin_all" on session_notes
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "session_notes_counsellor_read" on session_notes;
create policy "session_notes_counsellor_read" on session_notes
  for select
  using (current_user_role() = 'counsellor');

create index if not exists session_events_session_idx
  on session_events (session_id, occurred_at desc);

create index if not exists session_moods_session_idx
  on session_moods (session_id, occurred_at desc);

create index if not exists session_notes_session_idx
  on session_notes (session_id, occurred_at desc);
