import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'
import { isAdminOwner } from '@/lib/admin-owner'
import type { Role } from '@/lib/supabase/types'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, display_name').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, display_name, role } = await req.json() as { userId?: string; display_name?: string; role?: Role }
  if (!userId || !display_name || !role) {
    return NextResponse.json({ error: 'User, display name and role are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: target, error: targetError } = await admin.from('users').select('id, role, display_name').eq('id', userId).single()
  if (targetError || !target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const currentUserIsOwner = await isAdminOwner(user.id)
  const targetIsOwner = await isAdminOwner(target.id)
  const roleChanging = target.role !== role
  const adminRoleChange = target.role === 'admin' || role === 'admin' || target.role === 'owner' || role === 'owner'

  if (targetIsOwner) {
    return NextResponse.json({ error: 'The owner account cannot be modified' }, { status: 403 })
  }

  if (adminRoleChange && !currentUserIsOwner) {
    return NextResponse.json({ error: 'Only the owner can change admin or owner roles' }, { status: 403 })
  }

  const { error } = await admin.from('users').update({ display_name, role }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity({
    userId: user.id,
    displayName: profile.display_name ?? undefined,
    action: roleChanging ? 'update_user_role' : 'update_user_profile',
    resourceType: 'user',
    resourceId: userId,
    metadata: {
      target_display_name_before: target.display_name,
      target_display_name_after: display_name,
      target_role_before: target.role,
      target_role_after: role,
    },
    request: req,
  })

  return NextResponse.json({
    id: target.id,
    display_name,
    role,
  })
}
