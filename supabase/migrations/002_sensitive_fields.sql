alter table mental_health_incidents add column sensitive_fields text[] not null default '{}';
alter table drug_tracker_sessions   add column sensitive_fields text[] not null default '{}';
