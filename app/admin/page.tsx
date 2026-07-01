import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import AdminClient from './AdminClient'
import Link from 'next/link'
import { parseRolePermissions } from '@/lib/role-permissions'
import { can, getPermissionContext } from '@/lib/auth'
import { isAdminOwner } from '@/lib/admin-owner'

const TAB_RESOURCE_MAP = {
  users: 'admin_users',
  roles: 'admin_roles',
  bans: 'admin_bans',
  activity: 'admin_activity',
  config: 'admin_config',
  lockdown: 'admin_lockdown',
} as const

export default async function AdminPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  const { overrides, roleDefaults } = await getPermissionContext(profile.id)
  if (!can(profile, overrides, 'admin', 'view', roleDefaults)) redirect('/dashboard')

  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    { data: users },
    { data: allPermissions },
    { data: bans },
    { data: activityLogs },
    { data: configRows },
  ] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: true }),
    supabase.from('permissions').select('user_id'),
    admin.from('bans').select('*').order('created_at', { ascending: false }),
    admin.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
    admin.from('site_config').select('key, value, updated_at'),
  ])

  const overrideCounts: Record<string, number> = {}
  for (const p of allPermissions ?? []) {
    overrideCounts[p.user_id] = (overrideCounts[p.user_id] ?? 0) + 1
  }

  const config = Object.fromEntries((configRows ?? []).map(r => [r.key, r.value ?? '']))
  const rolePermissions = parseRolePermissions(config.role_permissions)
  const allowedTabs = (Object.entries(TAB_RESOURCE_MAP) as Array<[keyof typeof TAB_RESOURCE_MAP, typeof TAB_RESOURCE_MAP[keyof typeof TAB_RESOURCE_MAP]]>)
    .filter(([, resource]) => can(profile, overrides, resource, 'view', roleDefaults))
    .map(([tab]) => tab)
  const canViewInvites = can(profile, overrides, 'admin_invites', 'view', roleDefaults)
  const canManageUsers = can(profile, overrides, 'admin_users', 'manage_users', roleDefaults)
  const canAssignPrivilegedRoles = await isAdminOwner(profile.id)

  if (allowedTabs.length === 0 && !canViewInvites) redirect('/dashboard')

  return (
    <AppShell userId={profile.id} role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-8 min-w-0">
          <h1 className="min-w-0 text-lg font-mono tracking-widest text-zinc-300 uppercase break-words [overflow-wrap:anywhere]">Admin</h1>
          {canViewInvites && (
            <Link href="/admin/invites" className="shrink-0 border border-zinc-700 text-zinc-400 hover:border-zinc-500 px-4 py-2 text-[11px] font-mono tracking-widest uppercase transition-colors">
              Manage Invites
            </Link>
          )}
        </div>
        <AdminClient
          users={users ?? []}
          currentUserId={profile.id}
          overrideCounts={overrideCounts}
          bans={bans ?? []}
          activityLogs={activityLogs ?? []}
          config={config}
          rolePermissions={rolePermissions}
          allowedTabs={allowedTabs}
          canManageUsers={canManageUsers}
          canAssignPrivilegedRoles={canAssignPrivilegedRoles}
        />
      </main>
    </AppShell>
  )
}
