import type { Action, Resource, Role } from './supabase/types'
import { ROLE_DEFAULTS } from './supabase/types'

export const ROLE_PERMISSION_ROLES: Role[] = ['owner', 'admin', 'counsellor', 'lawyer', 'viewer']
export const ROLE_PERMISSION_EDITABLE_ROLES: Role[] = ['admin', 'counsellor', 'lawyer', 'viewer']

export const MAIN_PAGE_RESOURCES: Resource[] = ['dashboard', 'incidents', 'tracker', 'documents', 'admin']
export const ADMIN_SECTION_RESOURCES: Resource[] = ['admin_users', 'admin_roles', 'admin_bans', 'admin_activity', 'admin_config', 'admin_lockdown', 'admin_invites']
export const ROLE_PERMISSION_RESOURCES: Resource[] = [...MAIN_PAGE_RESOURCES, ...ADMIN_SECTION_RESOURCES]

export const ROLE_PERMISSION_ACTIONS: Record<Resource, Action[]> = {
  dashboard: ['view'],
  incidents: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  tracker: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  documents: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  admin: ['view'],
  admin_users: ['view', 'manage_users'],
  admin_roles: ['view'],
  admin_bans: ['view'],
  admin_activity: ['view'],
  admin_config: ['view'],
  admin_lockdown: ['view'],
  admin_invites: ['view', 'manage_invites'],
}

export type RolePermissionsMatrix = Record<Role, Partial<Record<Resource, Action[]>>>

export function cloneRolePermissions(matrix: RolePermissionsMatrix): RolePermissionsMatrix {
  return Object.fromEntries(
    ROLE_PERMISSION_ROLES.map(role => [
      role,
      Object.fromEntries(
        ROLE_PERMISSION_RESOURCES.map(resource => [
          resource,
          [...(matrix[role]?.[resource] ?? [])],
        ]),
      ) as Partial<Record<Resource, Action[]>>,
    ]),
  ) as RolePermissionsMatrix
}

export function normalizeRolePermissions(matrix: Partial<RolePermissionsMatrix> | null | undefined): RolePermissionsMatrix {
  const next = cloneRolePermissions(ROLE_DEFAULTS as RolePermissionsMatrix)

  for (const role of ROLE_PERMISSION_ROLES) {
    if (role === 'owner') continue
    for (const resource of ROLE_PERMISSION_RESOURCES) {
      const actions = matrix?.[role]?.[resource]
      if (Array.isArray(actions)) {
        next[role][resource] = [...actions.filter((action): action is Action => ROLE_PERMISSION_ACTIONS[resource].includes(action))]
      }
    }
  }

  next.owner = cloneRolePermissions(ROLE_DEFAULTS as RolePermissionsMatrix).owner

  return next
}

export function parseRolePermissions(value: string | null | undefined): RolePermissionsMatrix {
  if (!value) return cloneRolePermissions(ROLE_DEFAULTS as RolePermissionsMatrix)
  try {
    return normalizeRolePermissions(JSON.parse(value) as Partial<RolePermissionsMatrix>)
  } catch {
    return cloneRolePermissions(ROLE_DEFAULTS as RolePermissionsMatrix)
  }
}

export function roleAllows(
  matrix: RolePermissionsMatrix,
  role: Role,
  resource: Resource,
  action: Action
) {
  return matrix[role]?.[resource]?.includes(action) ?? false
}
