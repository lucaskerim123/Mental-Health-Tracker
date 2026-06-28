-- Plan 1 incident schema update.
-- Review before applying. This preserves mental_health_incidents.id as the
-- internal UUID and adds locked human-readable incident numbers separately.

alter table public.mental_health_incidents
  add column if not exists incident_number bigint,
  add column if not exists location text,
  add column if not exists outcome text,
  add column if not exists professional_note text,
  add column if not exists field_visibility jsonb not null default jsonb_build_object(
    'description', 'viewer+',
    'notes', 'viewer+',
    'personal_notes', 'counsellor+',
    'professional_note', 'counsellor+',
    'location', 'viewer+',
    'people_involved', 'viewer+',
    'outcome', 'viewer+'
  );

create sequence if not exists public.mental_health_incident_number_seq;

with numbered as (
  select
    id,
    row_number() over (order by created_at, occurred_at, id) as next_number
  from public.mental_health_incidents
  where incident_number is null
)
update public.mental_health_incidents incidents
set incident_number = numbered.next_number
from numbered
where incidents.id = numbered.id;

select setval(
  'public.mental_health_incident_number_seq',
  greatest(
    coalesce((select max(incident_number) from public.mental_health_incidents), 0),
    1
  ),
  true
);

alter table public.mental_health_incidents
  alter column incident_number set not null,
  alter column incident_number set default nextval('public.mental_health_incident_number_seq');

alter sequence public.mental_health_incident_number_seq
  owned by public.mental_health_incidents.incident_number;

create unique index if not exists mental_health_incidents_incident_number_key
  on public.mental_health_incidents (incident_number);

alter table public.mental_health_incidents
  add constraint mental_health_incidents_field_visibility_is_object
  check (jsonb_typeof(field_visibility) = 'object');

create or replace function public.set_incident_number()
returns trigger
language plpgsql
as $$
begin
  if new.incident_number is null then
    new.incident_number := nextval('public.mental_health_incident_number_seq');
  end if;

  return new;
end;
$$;

create or replace function public.prevent_incident_number_update()
returns trigger
language plpgsql
as $$
begin
  if new.incident_number is distinct from old.incident_number then
    raise exception 'incident_number is locked and cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists set_incident_number_before_insert
  on public.mental_health_incidents;

create trigger set_incident_number_before_insert
before insert on public.mental_health_incidents
for each row
execute function public.set_incident_number();

drop trigger if exists prevent_incident_number_update_before_update
  on public.mental_health_incidents;

create trigger prevent_incident_number_update_before_update
before update on public.mental_health_incidents
for each row
execute function public.prevent_incident_number_update();

revoke execute on function public.set_incident_number() from public;
revoke execute on function public.prevent_incident_number_update() from public;
