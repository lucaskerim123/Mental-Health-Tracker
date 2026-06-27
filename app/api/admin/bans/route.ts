import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'

export async function GET() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin.from('bans').select('*').order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { type, value, reason, expires_at } = await request.json()
  if (!type || !value) return NextResponse.json({ error: 'type and value required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('bans').insert({
    type,
    value,
    reason: reason || null,
    expires_at: expires_at || null,
    created_by: profile.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity({
    userId: profile.id,
    displayName: profile.display_name,
    action: 'create_ban',
    resourceType: 'ban',
    resourceId: data.id,
    metadata: { type, value, reason },
  })

  return NextResponse.json(data)
}
