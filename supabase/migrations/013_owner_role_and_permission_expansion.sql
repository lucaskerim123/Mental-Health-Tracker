alter type user_role add value if not exists 'lawyer';
alter type user_role add value if not exists 'owner';

alter type perm_resource add value if not exists 'dashboard';
alter type perm_resource add value if not exists 'admin_users';
alter type perm_resource add value if not exists 'admin_roles';
alter type perm_resource add value if not exists 'admin_bans';
alter type perm_resource add value if not exists 'admin_activity';
alter type perm_resource add value if not exists 'admin_config';
alter type perm_resource add value if not exists 'admin_lockdown';
alter type perm_resource add value if not exists 'admin_invites';

update users
set role = 'owner'
where id = (
  select value::uuid
  from site_config
  where key = 'admin_owner_id'
  limit 1
);

insert into site_config (key, value)
values (
  'role_permissions',
  '{"owner":{"dashboard":["view"],"incidents":["view","view_sensitive","create","edit","delete"],"tracker":["view","view_sensitive","create","edit","delete"],"documents":["view","view_sensitive","create","edit","delete"],"admin":["view"],"admin_users":["view","manage_users"],"admin_roles":["view"],"admin_bans":["view"],"admin_activity":["view"],"admin_config":["view"],"admin_lockdown":["view"],"admin_invites":["view","manage_invites"]},"admin":{"dashboard":["view"],"incidents":["view","view_sensitive","create","edit","delete"],"tracker":["view","view_sensitive","create","edit","delete"],"documents":["view","view_sensitive","create","edit","delete"],"admin":["view"],"admin_users":["view","manage_users"],"admin_roles":["view"],"admin_bans":["view"],"admin_activity":["view"],"admin_config":["view"],"admin_lockdown":["view"],"admin_invites":["view","manage_invites"]},"counsellor":{"dashboard":["view"],"incidents":["view","view_sensitive"],"tracker":["view","view_sensitive"],"documents":["view","view_sensitive"]},"lawyer":{"dashboard":["view"],"incidents":["view","view_sensitive"],"tracker":["view","view_sensitive"],"documents":["view","view_sensitive"]},"viewer":{"dashboard":["view"],"incidents":["view"],"tracker":["view"],"documents":["view"]}}'
)
on conflict (key) do update
set value = excluded.value;
