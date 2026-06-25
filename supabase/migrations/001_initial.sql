-- Enums
create type user_role as enum ('admin', 'counsellor', 'viewer');
create type perm_resource as enum ('incidents', 'tracker', 'documents', 'users', 'admin');
create type perm_action as enum ('view', 'view_sensitive', 'create', 'edit', 'delete', 'manage_users', 'manage_invites');
create type doc_attach_type as enum ('incident', 'tracker_session', 'none');

-- Users (profile table extending auth.users)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role user_role not null default 'viewer',
  created_at timestamptz default now()
);

-- Invites
create table invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  created_by uuid references users(id) on delete set null,
  used_by uuid references users(id) on delete set null,
  role_to_assign user_role not null default 'viewer',
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Mental health incidents
create table mental_health_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  severity int not null check (severity between 1 and 10),
  description text not null,
  is_sensitive boolean not null default false,
  personal_notes text,
  notes text,
  created_at timestamptz default now()
);

-- Drug tracker sessions
create table drug_tracker_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date_start date not null,
  date_end date,
  sleep_hours numeric not null default 0,
  any_incidents text,
  personal_reflection text,
  notes text,
  is_sensitive boolean not null default false,
  created_at timestamptz default now()
);

-- Sleep log
create table sleep_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references drug_tracker_sessions(id) on delete cascade,
  hours_added numeric not null,
  logged_at timestamptz default now()
);

-- Documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references users(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text not null default '',
  is_sensitive boolean not null default false,
  allowed_user_ids uuid[] not null default '{}',
  attached_to_type doc_attach_type not null default 'none',
  attached_to_id uuid,
  created_at timestamptz default now()
);

-- Permissions (per-user overrides)
create table permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  resource perm_resource not null,
  action perm_action not null,
  granted boolean not null,
  unique (user_id, resource, action)
);

-- Trigger: create user profile on auth signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  invite_record invites%rowtype;
  assigned_role user_role := 'viewer';
begin
  if new.raw_user_meta_data ? 'invite_token' then
    select * into invite_record
    from invites
    where token = (new.raw_user_meta_data->>'invite_token')
      and used_by is null
      and expires_at > now();

    if found then
      assigned_role := invite_record.role_to_assign;
    end if;
  end if;

  insert into users (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    assigned_role
  );

  if invite_record.id is not null then
    update invites set used_by = new.id where id = invite_record.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Enable RLS
alter table users enable row level security;
alter table invites enable row level security;
alter table mental_health_incidents enable row level security;
alter table drug_tracker_sessions enable row level security;
alter table sleep_log enable row level security;
alter table documents enable row level security;
alter table permissions enable row level security;

-- Helper: get current user's role
create or replace function current_user_role()
returns user_role language sql security definer stable as $$
  select role from users where id = auth.uid();
$$;

-- RLS: users table
create policy "users_select" on users for select
  using (auth.uid() = id or current_user_role() in ('admin', 'counsellor'));
create policy "users_update_admin" on users for update
  using (current_user_role() = 'admin');
create policy "users_delete_admin" on users for delete
  using (current_user_role() = 'admin');

-- RLS: invites
create policy "invites_select_token" on invites for select
  using (used_by is null or current_user_role() = 'admin');
create policy "invites_all_admin" on invites for all
  using (current_user_role() = 'admin');

-- RLS: incidents
create policy "incidents_select" on mental_health_incidents for select
  using (
    current_user_role() in ('admin', 'counsellor')
    or (current_user_role() = 'viewer' and is_sensitive = false)
  );
create policy "incidents_insert_admin" on mental_health_incidents for insert
  with check (current_user_role() = 'admin');
create policy "incidents_update_admin" on mental_health_incidents for update
  using (current_user_role() = 'admin');
create policy "incidents_delete_admin" on mental_health_incidents for delete
  using (current_user_role() = 'admin');

-- RLS: tracker sessions
create policy "tracker_select" on drug_tracker_sessions for select
  using (
    current_user_role() in ('admin', 'counsellor')
    or (current_user_role() = 'viewer' and is_sensitive = false)
  );
create policy "tracker_insert_admin" on drug_tracker_sessions for insert
  with check (current_user_role() = 'admin');
create policy "tracker_update_admin" on drug_tracker_sessions for update
  using (current_user_role() = 'admin');
create policy "tracker_delete_admin" on drug_tracker_sessions for delete
  using (current_user_role() = 'admin');

-- RLS: sleep log
create policy "sleep_select" on sleep_log for select
  using (current_user_role() in ('admin', 'counsellor'));
create policy "sleep_insert_admin" on sleep_log for insert
  with check (current_user_role() = 'admin');

-- RLS: documents
create policy "docs_select" on documents for select
  using (
    current_user_role() = 'admin'
    or (current_user_role() = 'counsellor' and (not is_sensitive or true))
    or (current_user_role() = 'viewer' and is_sensitive = false
        and (array_length(allowed_user_ids, 1) is null
             or auth.uid() = any(allowed_user_ids)))
  );
create policy "docs_insert_admin" on documents for insert
  with check (current_user_role() = 'admin');
create policy "docs_delete_admin" on documents for delete
  using (current_user_role() = 'admin');

-- RLS: permissions
create policy "perms_select" on permissions for select
  using (current_user_role() = 'admin' or user_id = auth.uid());
create policy "perms_all_admin" on permissions for all
  using (current_user_role() = 'admin');
