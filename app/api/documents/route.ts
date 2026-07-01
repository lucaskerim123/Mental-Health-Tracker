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
  const { data, error } = await admin.from('documents').insert({
    uploaded_by: user.id,
    filename: body.filename,
    storage_path: body.storage_path,
    mime_type: body.mime_type,
    is_sensitive: !!body.is_sensitive,
    allowed_user_ids: [],
    attached_to_type: 'none',
    attached_to_id: null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity({
    userId: user.id,
    displayName: profile.display_name ?? undefined,
    action: 'create_document',
    resourceType: 'document',
    resourceId: data.id,
    metadata: {
      filename: body.filename,
      mime_type: body.mime_type,
      storage_path: body.storage_path,
      is_sensitive: !!body.is_sensitive,
    },
    request: req,
  })

  return NextResponse.json(data)
}
