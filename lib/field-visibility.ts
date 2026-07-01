import type { FieldVisibilityLevel, Role } from './supabase/types'

const ROLE_LEVEL: Record<Role, number> = {
  owner: 5,
  admin: 4,
  counsellor: 3,
  lawyer: 2,
  viewer: 1,
}

const FIELD_LEVEL: Record<FieldVisibilityLevel, number> = {
  'viewer+': 1,
  'lawyer+': 2,
  'counsellor+': 3,
  'admin only': 4,
}

export function canViewFieldLevel(role: Role, level: FieldVisibilityLevel) {
  return ROLE_LEVEL[role] >= FIELD_LEVEL[level]
}
