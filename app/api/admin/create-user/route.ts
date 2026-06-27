import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, display_name, password, role } = await req.json()
  if (!email || !display_name || !password || !role) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const uid = authData.user.id
  const { error: profileError } = await admin
    .from('users')
    .upsert({ id: uid, display_name, role }, { onConflict: 'id' })

  if (profileError) {
    await admin.auth.admin.deleteUser(uid)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ id: uid, display_name, role, email, created_at: new Date().toISOString() })
}
