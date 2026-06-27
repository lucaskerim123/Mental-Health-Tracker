create table drug_use_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references drug_tracker_sessions(id) on delete cascade,
  substance text not null,
  amount numeric,
  unit text,
  notes text,
  logged_at timestamptz default now()
);

alter table drug_use_log enable row level security;

create policy "drug_use_select" on drug_use_log for select
  using (current_user_role() in ('admin', 'counsellor'));
create policy "drug_use_insert_admin" on drug_use_log for insert
  with check (current_user_role() = 'admin');
create policy "drug_use_delete_admin" on drug_use_log for delete
  using (current_user_role() = 'admin');
