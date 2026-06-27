create table if not exists tracker_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references drug_tracker_sessions(id) on delete cascade,
  content text not null,
  source text not null default 'ui',
  created_at timestamptz default now()
);

alter table tracker_entries enable row level security;

create policy "tracker_entries_admin_all" on tracker_entries
  for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

create policy "tracker_entries_counsellor_read" on tracker_entries
  for select
  using (current_user_role() = 'counsellor');

create index if not exists tracker_entries_session_idx
  on tracker_entries (session_id, created_at desc);
