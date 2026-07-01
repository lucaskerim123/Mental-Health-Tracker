import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'
import type { IncidentFieldVisibility } from '@/lib/supabase/types'

function isMissingBriefSummaryColumnError(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return error?.code === '42703' || (message.includes('brief_summary') && message.includes('column'))
}

function canWriteIncidents(role: string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, display_name').eq('id', user.id).single()
  if (!canWriteIncidents(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()
  const basePayload = {
    occurred_at: body.occurred_at,
    severity: body.severity,
    description: body.description,
    location: body.location,
    personal_notes: body.personal_notes,
    notes: body.notes,
    professional_note: body.professional_note,
    outcome: body.outcome,
    substance_use: body.substance_use,
    police_called: body.police_called,
    was_arrested: body.was_arrested,
    ambulance_called: body.ambulance_called,
    was_sectioned: body.was_sectioned,
    is_sensitive: body.is_sensitive,
    tracker_session_id: body.tracker_session_id,
    user_id: user.id,
    people_involved: body.people_involved ?? [],
    sensitive_fields: body.sensitive_fields ?? [],
    field_visibility: body.field_visibility as IncidentFieldVisibility,
  }

  const withSummary = { ...basePayload, brief_summary: body.brief_summary ?? null }
  let result = await admin.from('mental_health_incidents').insert(withSummary).select().single()
  if (result.error && isMissingBriefSummaryColumnError(result.error)) {
    result = await admin.from('mental_health_incidents').insert(basePayload).select().single()
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })

  await logActivity({
    userId: user.id,
    displayName: profile.display_name ?? undefined,
    action: 'create_incident',
    resourceType: 'incident',
    resourceId: result.data.id,
    metadata: {
      severity: body.severity,
      tracker_session_id: body.tracker_session_id ?? null,
      has_brief_summary: !!body.brief_summary,
    },
    request: req,
  })

  return NextResponse.json(result.data)
}
