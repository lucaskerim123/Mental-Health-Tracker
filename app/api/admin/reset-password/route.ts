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

  const { userId, password } = await req.json()
  if (!userId || !password) {
    return NextResponse.json({ error: 'User and password are required' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: targetUser, error: lookupError } = await admin.auth.admin.getUserById(userId)
  if (lookupError || !targetUser?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password })
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  await logActivity({
    userId: user.id,
    displayName: profile?.display_name ?? undefined,
    action: 'reset_password',
    resourceType: 'user',
    resourceId: userId,
    metadata: { target_email: targetUser.user.email ?? null },
  })

  return NextResponse.json({ ok: true })
}
