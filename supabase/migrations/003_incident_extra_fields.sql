alter table mental_health_incidents
  add column if not exists names_involved text,
  add column if not exists substance_use text check (substance_use in ('no', 'yes', 'comedown')),
  add column if not exists emergency_services boolean not null default false;
