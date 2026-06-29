-- Align the live schema with the current app/MCP expectations.
-- This migration is additive: it keeps legacy columns working while adding
-- the newer structured session note and event fields used by the repo.

begin;

-- ---------------------------------------------------------------------------
-- session_notes
-- ---------------------------------------------------------------------------

alter table public.session_notes
  add column if not exists content text,
  add column if not exists source text not null default 'app',
  add column if not exists entry_type text not null default 'note',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists visibility text not null default 'counsellor+',
  add column if not exists occurred_at timestamptz not null default now();

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

-- ---------------------------------------------------------------------------
-- session_events
-- ---------------------------------------------------------------------------

alter table public.session_events
  add column if not exists title text not null default 'Session event',
  add column if not exists content text not null default '',
  add column if not exists entry_type text not null default 'event',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists visibility text not null default 'counsellor+';

update public.session_events
set
  title = coalesce(nullif(title, ''), event_type, 'Session event'),
  content = coalesce(nullif(content, ''), event_type, ''),
  entry_type = coalesce(nullif(entry_type, ''), 'event'),
  metadata = coalesce(metadata, '{}'::jsonb),
  visibility = coalesce(nullif(visibility, ''), 'counsellor+')
where true;

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
  using (
    current_user_role() = 'counsellor'
    and visibility in ('viewer+', 'counsellor+')
  );

drop policy if exists "session_events_viewer_read" on public.session_events;
create policy "session_events_viewer_read" on public.session_events
  for select
  using (
    current_user_role() = 'viewer'
    and visibility = 'viewer+'
  );

create index if not exists session_events_session_idx
  on public.session_events (session_id, occurred_at desc);

create index if not exists session_events_session_type_idx
  on public.session_events (session_id, entry_type, occurred_at desc);

commit;
