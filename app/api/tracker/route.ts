import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, display_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()
  const payload = {
    date_start: body.date_start,
    brief_notes: body.brief_notes,
    counsellor_notes: body.counsellor_notes,
    lawyer_notes: body.lawyer_notes,
    personal_reflection: body.personal_reflection,
    notes: body.notes,
    is_sensitive: body.is_sensitive,
    user_id: user.id,
    sleep_hours: 0,
    sensitive_fields: body.sensitive_fields ?? [],
  }

  let result = await admin.from('drug_tracker_sessions').insert(payload).select().single()
  if (result.error) {
    result = await admin.from('drug_tracker_sessions').insert({
      date_start: payload.date_start,
      personal_reflection: payload.personal_reflection,
      notes: payload.notes,
      is_sensitive: payload.is_sensitive,
      user_id: payload.user_id,
      sleep_hours: payload.sleep_hours,
      sensitive_fields: payload.sensitive_fields,
    }).select().single()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })

  await logActivity({
    userId: user.id,
    displayName: profile.display_name ?? undefined,
    action: 'create_tracker_session',
    resourceType: 'tracker_session',
    resourceId: result.data.id,
    metadata: {
      date_start: body.date_start,
      is_sensitive: body.is_sensitive,
    },
    request: req,
  })

  return NextResponse.json(result.data)
}
