import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: ban } = await admin.from('bans').select('type, value').eq('id', id).single()
  const { error } = await admin.from('bans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity({
    userId: profile.id,
    displayName: profile.display_name,
    action: 'remove_ban',
    resourceType: 'ban',
    resourceId: id,
    metadata: { type: ban?.type, value: ban?.value },
  })

  return NextResponse.json({ ok: true })
}
