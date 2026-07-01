import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminOwnerId } from '@/lib/admin-owner'
import { logActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existingOwnerId = await getAdminOwnerId()
  if (existingOwnerId && existingOwnerId !== user.id) {
    return NextResponse.json({ error: 'An owner is already configured' }, { status: 409 })
  }

  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('users')
    .update({ role: 'owner' })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const { error: configError } = await admin
    .from('site_config')
    .upsert({
      key: 'admin_owner_id',
      value: user.id,
      updated_at: new Date().toISOString(),
    })

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 400 })
  }

  await logActivity({
    userId: user.id,
    displayName: profile?.display_name ?? undefined,
    action: 'claim_owner',
    resourceType: 'user',
    resourceId: user.id,
    request,
  })

  return NextResponse.json({ ok: true })
}
