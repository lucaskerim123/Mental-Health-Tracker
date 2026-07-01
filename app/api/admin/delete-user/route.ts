import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'
import { isAdminOwner } from '@/lib/admin-owner'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, display_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (userId === user.id) return NextResponse.json({ error: "Can't delete yourself" }, { status: 400 })

  const admin = createAdminClient()
  const { data: target, error: targetError } = await admin.from('users').select('id, role, display_name').eq('id', userId).single()
  if (targetError || !target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'admin' && !(await isAdminOwner(user.id))) {
    return NextResponse.json({ error: 'Only the admin owner can delete admin accounts' }, { status: 403 })
  }
  if (await isAdminOwner(target.id)) {
    return NextResponse.json({ error: 'The admin owner account cannot be deleted' }, { status: 403 })
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity({
    userId: user.id,
    displayName: profile.display_name ?? undefined,
    action: 'delete_user',
    resourceType: 'user',
    resourceId: userId,
    metadata: { target_display_name: target.display_name, target_role: target.role },
    request: req,
  })

  return NextResponse.json({ success: true })
}
