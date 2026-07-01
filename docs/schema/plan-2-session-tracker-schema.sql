-- Plan 2 session tracker schema, rebuilt to match the current app state.
-- This is a documentation/schema reference, not a migration to run blindly.

begin;

create sequence if not exists public.drug_tracker_session_number_seq;

alter table public.drug_tracker_sessions
  add column if not exists session_number bigint,
  add column if not exists brief_notes text,
  add column if not exists counsellor_notes text,
  add column if not exists lawyer_notes text,
  add column if not exists field_visibility jsonb not null default jsonb_build_object(
    'brief_notes', 'viewer+',
    'notes', 'counsellor+',
    'usage_log', 'counsellor+',
    'counsellor_notes', 'counsellor+',
    'lawyer_notes', 'lawyer+',
    'private_notes', 'admin only',
    'mcp_outputs', 'admin only'
  );

with numbered as (
  select
    id,
    row_number() over (order by created_at nulls last, date_start nulls last, id) as rn
  from public.drug_tracker_sessions
  where session_number is null
)
update public.drug_tracker_sessions s
set session_number = numbered.rn
from numbered
where s.id = numbered.id;

select setval(
  'public.drug_tracker_session_number_seq',
  greatest(coalesce((select max(session_number) from public.drug_tracker_sessions), 0), 1),
  true
);

create or replace function public.set_drug_tracker_session_number()
returns trigger
language plpgsql
as $$
begin
  if new.session_number is null then
    new.session_number := nextval('public.drug_tracker_session_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists set_drug_tracker_session_number on public.drug_tracker_sessions;
create trigger set_drug_tracker_session_number
  before insert on public.drug_tracker_sessions
  for each row
  execute function public.set_drug_tracker_session_number();

create or replace function public.prevent_drug_tracker_session_number_update()
returns trigger
language plpgsql
as $$
begin
  if old.session_number is distinct from new.session_number then
    raise exception 'session_number is locked and cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_drug_tracker_session_number_update on public.drug_tracker_sessions;
create trigger prevent_drug_tracker_session_number_update
  before update on public.drug_tracker_sessions
  for each row
  execute function public.prevent_drug_tracker_session_number_update();

create unique index if not exists drug_tracker_sessions_session_number_key
  on public.drug_tracker_sessions (session_number);

alter table public.drug_tracker_sessions
  alter column session_number set not null;

alter table public.drug_tracker_sessions
  drop constraint if exists drug_tracker_sessions_field_visibility_object;

alter table public.drug_tracker_sessions
  add constraint drug_tracker_sessions_field_visibility_object
  check (jsonb_typeof(field_visibility) = 'object') not valid;

alter table public.tracker_entries
  add column if not exists entry_type text not null default 'entry',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists visibility text not null default 'admin only',
  add column if not exists incident_id uuid references public.mental_health_incidents(id) on delete set null;

alter table public.tracker_entries
  drop constraint if exists tracker_entries_visibility_check;

alter table public.tracker_entries
  add constraint tracker_entries_visibility_check
  check (visibility in ('viewer+', 'counsellor+', 'lawyer+', 'admin only')) not valid;

create index if not exists tracker_entries_incident_idx
  on public.tracker_entries (incident_id)
  where incident_id is not null;

create index if not exists tracker_entries_session_type_idx
  on public.tracker_entries (session_id, entry_type, created_at desc);

alter table public.session_moods
  add column if not exists source text not null default 'app',
  add column if not exists notes text,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.session_moods enable row level security;

drop policy if exists "session_moods_admin_all" on public.session_moods;
create policy "session_moods_admin_all" on public.session_moods
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "session_moods_counsellor_read" on public.session_moods;
create policy "session_moods_counsellor_read" on public.session_moods
  for select
  using (current_user_role() = 'counsellor');

create index if not exists session_moods_session_idx
  on public.session_moods (session_id, occurred_at desc);

alter table public.session_notes
  add column if not exists content text,
  add column if not exists source text not null default 'app',
  add column if not exists entry_type text not null default 'note',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists visibility text not null default 'counsellor+',
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

update public.session_notes
set content = coalesce(content, note)
where content is null;

alter table public.session_notes
  alter column content set not null;

alter table public.session_notes
  drop constraint if exists session_notes_visibility_check;

alter table public.session_notes
  add constraint session_notes_visibility_check
  check (visibility in ('viewer+', 'counsellor+', 'lawyer+', 'admin only')) not valid;

create or replace function public.sync_session_notes_columns()
returns trigger
language plpgsql
as $$
begin
  new.content := coalesce(nullif(new.content, ''), new.note, '');
  new.note := coalesce(nullif(new.note, ''), new.content, '');
  new.source := coalesce(nullif(new.source, ''), 'app');
  new.entry_type := coalesce(nullif(new.entry_type, ''), 'note');
  new.visibility := coalesce(nullif(new.visibility, ''), 'counsellor+');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.occurred_at := coalesce(new.occurred_at, now());
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists sync_session_notes_columns on public.session_notes;
create trigger sync_session_notes_columns
  before insert or update on public.session_notes
  for each row
  execute function public.sync_session_notes_columns();

alter table public.session_notes enable row level security;

drop policy if exists "session_notes_admin_all" on public.session_notes;
create policy "session_notes_admin_all" on public.session_notes
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "session_notes_counsellor_read" on public.session_notes;
create policy "session_notes_counsellor_read" on public.session_notes
  for select
  using (
    current_user_role() = 'counsellor'
    and visibility in ('viewer+', 'counsellor+')
  );

drop policy if exists "session_notes_viewer_read" on public.session_notes;
create policy "session_notes_viewer_read" on public.session_notes
  for select
  using (
    current_user_role() = 'viewer'
    and visibility = 'viewer+'
  );

create index if not exists session_notes_session_idx
  on public.session_notes (session_id, occurred_at desc);

create index if not exists session_notes_session_type_idx
  on public.session_notes (session_id, entry_type, occurred_at desc);

alter table public.session_events
  add column if not exists title text not null default 'Session event',
  add column if not exists content text not null default '',
  add column if not exists entry_type text not null default 'event',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists visibility text not null default 'counsellor+',
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

update public.session_events
set
  title = coalesce(nullif(title, ''), event_type, 'Session event'),
  content = coalesce(nullif(content, ''), event_type, ''),
  entry_type = coalesce(nullif(entry_type, ''), 'event'),
  metadata = coalesce(metadata, '{}'::jsonb),
  visibility = coalesce(nullif(visibility, ''), 'counsellor+');

alter table public.session_events
  drop constraint if exists session_events_visibility_check;

alter table public.session_events
  add constraint session_events_visibility_check
  check (visibility in ('viewer+', 'counsellor+', 'lawyer+', 'admin only')) not valid;

alter table public.session_events enable row level security;

drop policy if exists "session_events_admin_all" on public.session_events;
create policy "session_events_admin_all" on public.session_events
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

drop policy if exists "session_events_counsellor_read" on public.session_events;
create policy "session_events_counsellor_read" on public.session_events
  for select
  using (current_user_role() = 'counsellor');

create index if not exists session_events_session_idx
  on public.session_events (session_id, occurred_at desc);

create index if not exists session_events_session_type_idx
  on public.session_events (session_id, entry_type, occurred_at desc);

alter table public.mental_health_incidents
  add column if not exists tracker_session_id uuid references public.drug_tracker_sessions(id) on delete set null;

create index if not exists mental_health_incidents_tracker_session_idx
  on public.mental_health_incidents (tracker_session_id)
  where tracker_session_id is not null;

commit;
