-- Add the incident front-card summary field to the live schema.

alter table public.mental_health_incidents
  add column if not exists brief_summary text;

alter table public.mental_health_incidents
  alter column brief_summary drop not null;

update public.mental_health_incidents
set brief_summary = coalesce(nullif(brief_summary, ''), left(description, 160))
where brief_summary is null and description is not null;
