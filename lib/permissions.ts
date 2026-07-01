import { redirect } from 'next/navigation'
import type { Action, Permission, Resource, Role, UserProfile } from './supabase/types'
import { getPermissionContext, getProfile, can } from './auth'

export const ROLE_HIERARCHY: Role[] = ['owner', 'admin', 'counsellor', 'lawyer', 'viewer']

export function isOwner(profile: Pick<UserProfile, 'role'> | null | undefined) {
  return profile?.role === 'owner'
}

export function isAdminLike(profile: Pick<UserProfile, 'role'> | null | undefined) {
  return profile?.role === 'owner' || profile?.role === 'admin'
}

export function canUse(
  profile: UserProfile,
  overrides: Permission[],
  resource: Resource,
  action: Action,
  roleDefaults?: Parameters<typeof can>[4]
) {
  return can(profile, overrides, resource, action, roleDefaults)
}

export async function requireUser() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

export async function getAccessContext(profile: UserProfile) {
  const { overrides, roleDefaults } = await getPermissionContext(profile.id)
  return {
    profile,
    overrides,
    roleDefaults,
    isOwner: profile.role === 'owner',
    isAdmin: profile.role === 'admin',
    isAdminLike: isAdminLike(profile),
    can: (resource: Resource, action: Action) => can(profile, overrides, resource, action, roleDefaults),
  }
}

export async function requirePermission(resource: Resource, action: Action) {
  const profile = await requireUser()
  const access = await getAccessContext(profile)
  if (!access.can(resource, action)) redirect('/dashboard')
  return access
}

export function forbiddenUnless(access: { can: (resource: Resource, action: Action) => boolean }, resource: Resource, action: Action) {
  return access.can(resource, action)
}

export function ownerRedactsTarget(viewer: Pick<UserProfile, 'role'>, targetIsOwner: boolean) {
  return targetIsOwner && viewer.role !== 'owner'
}
