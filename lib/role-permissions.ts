import type { Action, Resource, Role } from './supabase/types'
import { ROLE_DEFAULTS } from './supabase/types'

export const ROLE_PERMISSION_ROLES: Role[] = ['viewer', 'lawyer', 'counsellor', 'admin']
export const ROLE_PERMISSION_EDITABLE_ROLES: Role[] = ['viewer', 'lawyer', 'counsellor']

export const ROLE_PERMISSION_RESOURCES: Resource[] = ['incidents', 'tracker', 'documents', 'users', 'admin']

export const ROLE_PERMISSION_ACTIONS: Record<Resource, Action[]> = {
  incidents: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  tracker: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  documents: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  users: ['manage_users', 'manage_invites'],
  admin: ['view'],
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
    if (role === 'admin') continue
    for (const resource of ROLE_PERMISSION_RESOURCES) {
      const actions = matrix?.[role]?.[resource]
      if (Array.isArray(actions)) {
        next[role][resource] = [...actions.filter((action): action is Action => ROLE_PERMISSION_ACTIONS[resource].includes(action))]
      }
    }
  }

  next.admin = cloneRolePermissions(ROLE_DEFAULTS as RolePermissionsMatrix).admin

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
