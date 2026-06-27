-- Site configuration (key-value store)
create table site_config (
  key text primary key,
  value text,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz default now()
);

alter table site_config enable row level security;

create policy "config_admin_all" on site_config for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

insert into site_config (key, value) values
  ('site_name', 'Mental Health Tracker'),
  ('site_description', 'Private health tracking portal'),
  ('lockdown_mode', 'false'),
  ('lockdown_pin_hash', null),
  ('lockdown_message', 'This site is temporarily unavailable.');

-- Bans (user_id or IP address)
create table bans (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('user', 'ip')),
  value text not null,
  reason text,
  created_by uuid references users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique (type, value)
);

alter table bans enable row level security;

create policy "bans_admin_all" on bans for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- Activity logs
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  display_name text,
  action text not null,
  resource_type text,
  resource_id text,
  ip_address text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table activity_logs enable row level security;

create policy "logs_admin_read" on activity_logs for select
  using (current_user_role() = 'admin');

create index activity_logs_created_at_idx on activity_logs (created_at desc);
