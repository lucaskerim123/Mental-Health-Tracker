import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'
import {
  cloneRolePermissions,
  parseRolePermissions,
  normalizeRolePermissions,
  ROLE_PERMISSION_EDITABLE_ROLES,
  ROLE_PERMISSION_ROLES,
  type RolePermissionsMatrix,
} from '@/lib/role-permissions'
import { isAdminOwner } from '@/lib/admin-owner'
import type { Role } from '@/lib/supabase/types'

async function loadRolePermissions(admin: ReturnType<typeof createAdminClient>): Promise<RolePermissionsMatrix> {
  const { data } = await admin.from('site_config').select('value').eq('key', 'role_permissions').maybeSingle()
  return parseRolePermissions(data?.value ?? null)
}

export async function GET() {
  const profile = await getProfile()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const rolePermissions = await loadRolePermissions(admin)
  return NextResponse.json({ role_permissions: rolePermissions })
}

export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role, permissions } = await request.json()
  if (!role || !permissions) return NextResponse.json({ error: 'role and permissions required' }, { status: 400 })
  if (!ROLE_PERMISSION_ROLES.includes(role as Role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  if (!ROLE_PERMISSION_EDITABLE_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: 'Owner permissions cannot be edited' }, { status: 403 })
  }

  const safeRole = role as Role
  if (safeRole === 'admin' && !(await isAdminOwner(profile.id))) {
    return NextResponse.json({ error: 'Only the owner can edit admin role permissions' }, { status: 403 })
  }
  const admin = createAdminClient()
  const current = await loadRolePermissions(admin)
  const next = cloneRolePermissions(current)
  next[safeRole] = normalizeRolePermissions({ [safeRole]: permissions } as Partial<RolePermissionsMatrix>)[safeRole]

  const { error } = await admin.from('site_config').upsert({
    key: 'role_permissions',
    value: JSON.stringify(next),
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity({
    userId: profile.id,
    displayName: profile.display_name,
    action: 'update_config',
    metadata: { key: 'role_permissions', role: safeRole },
    request,
  })

  return NextResponse.json({ role_permissions: next })
}
