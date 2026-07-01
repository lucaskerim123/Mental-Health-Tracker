import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: ban } = await admin.from('bans').select('type, value').eq('id', id).single()
  if (ban?.type === 'user') {
    const { data: target, error: targetError } = await admin.from('users').select('role').eq('id', ban.value).single()
    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 400 })
    if (target?.role === 'admin' || target?.role === 'owner') {
      return NextResponse.json({ error: 'Admin or owner account bans cannot be removed' }, { status: 403 })
    }
  }

  const { error } = await admin.from('bans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity({
    userId: profile.id,
    displayName: profile.display_name,
    action: 'remove_ban',
    resourceType: 'ban',
    resourceId: id,
    metadata: { type: ban?.type, value: ban?.value },
    request: req,
  })

  return NextResponse.json({ ok: true })
}
