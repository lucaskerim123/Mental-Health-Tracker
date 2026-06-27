import { createClient } from './supabase/server'
import type { UserProfile, Resource, Action, Permission } from './supabase/types'
import { ROLE_DEFAULTS } from './supabase/types'

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

export function can(
  profile: UserProfile,
  overrides: Permission[],
  resource: Resource,
  action: Action
): boolean {
  // Check explicit override first
  const override = overrides.find(p => p.resource === resource && p.action === action)
  if (override) return override.granted

  // Fall back to role defaults
  const rolePerms = ROLE_DEFAULTS[profile.role]
  return rolePerms[resource]?.includes(action) ?? false
}
