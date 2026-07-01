import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'
import type { Role } from '@/lib/supabase/types'

const INVITABLE_ROLES: Role[] = ['viewer', 'lawyer', 'counsellor']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, display_name').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { token, role, expires_at } = await req.json() as { token?: string; role?: Role; expires_at?: string }
  if (!token || !role || !expires_at) {
    return NextResponse.json({ error: 'Token, role and expiry are required' }, { status: 400 })
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invites can only assign viewer, lawyer or counsellor roles' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error, data } = await admin.from('invites').insert({
    token,
    created_by: user.id,
    role_to_assign: role,
    expires_at,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity({
    userId: user.id,
    displayName: profile.display_name ?? undefined,
    action: 'create_invite',
    resourceType: 'invite',
    resourceId: data.id,
    metadata: { role_to_assign: role, expires_at },
    request: req,
  })

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role, display_name').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { inviteId } = await req.json() as { inviteId?: string }
  if (!inviteId) return NextResponse.json({ error: 'Invite id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: invite, error: lookupError } = await admin.from('invites').select('id, role_to_assign').eq('id', inviteId).single()
  if (lookupError || !invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

  const { error } = await admin.from('invites').delete().eq('id', inviteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity({
    userId: user.id,
    displayName: profile.display_name ?? undefined,
    action: 'delete_invite',
    resourceType: 'invite',
    resourceId: inviteId,
    metadata: { role_to_assign: invite.role_to_assign },
    request: req,
  })

  return NextResponse.json({ ok: true })
}
