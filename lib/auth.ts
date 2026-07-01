import { createClient } from './supabase/server'
import type { UserProfile, Resource, Action, Permission } from './supabase/types'
import { ROLE_DEFAULTS } from './supabase/types'
import type { RolePermissionsMatrix } from './role-permissions'
import { parseRolePermissions } from './role-permissions'
import { createAdminClient } from './supabase/admin'

export async function getSession() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
  return data
}

export async function getPermissions(userId: string): Promise<Permission[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('permissions').select('*').eq('user_id', userId)
  return data ?? []
}

export async function getRolePermissions(): Promise<RolePermissionsMatrix> {
  const admin = createAdminClient()
  const { data } = await admin.from('site_config').select('value').eq('key', 'role_permissions').maybeSingle()
  return parseRolePermissions(data?.value ?? null)
}

export async function getPermissionContext(userId: string) {
  const [overrides, roleDefaults] = await Promise.all([
    getPermissions(userId),
    getRolePermissions(),
  ])

  return { overrides, roleDefaults }
}

export function can(
  profile: UserProfile,
  overrides: Permission[],
  resource: Resource,
  action: Action,
  roleDefaults: RolePermissionsMatrix = ROLE_DEFAULTS as RolePermissionsMatrix
): boolean {
  // Check explicit override first
  const override = overrides.find(p => p.resource === resource && p.action === action)
  if (override) return override.granted

  // Fall back to role defaults
  const rolePerms = roleDefaults[profile.role]
  return rolePerms[resource]?.includes(action) ?? false
}
