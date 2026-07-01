import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAdminOwnerId } from '@/lib/admin-owner'

export async function POST(req: NextRequest) {
  const admin = createAdminClient()

  const { count } = await admin.from('users').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 403 })
  }

  const { email, display_name, password } = await req.json()
  if (!email || !display_name || !password) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name },
  })
  if (authError) {
    console.error('setup authError:', JSON.stringify(authError))
    const msg = authError.message || (authError as { error_description?: string }).error_description
      || JSON.stringify(authError) || 'Auth error'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const uid = authData.user.id
  const { error: profileError } = await admin
    .from('users')
    .upsert({ id: uid, display_name, role: 'admin' }, { onConflict: 'id' })

  if (profileError) {
    console.error('setup profileError:', JSON.stringify(profileError))
    await admin.auth.admin.deleteUser(uid)
    return NextResponse.json({ error: profileError.message || profileError.details || JSON.stringify(profileError) }, { status: 400 })
  }

  await ensureAdminOwnerId(uid)

  return NextResponse.json({ success: true })
}
