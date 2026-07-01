import { NextRequest, NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivity } from '@/lib/activity'

async function sha256(str: string): Promise<string> {
  const data = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function GET() {
  const profile = await getProfile()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin.from('site_config').select('key, value, updated_at')
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const profile = await getProfile()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key, value } = await request.json()
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const admin = createAdminClient()

  // PIN is special: hash before storing, store under lockdown_pin_hash
  if (key === 'lockdown_pin') {
    if (!value) return NextResponse.json({ error: 'PIN required' }, { status: 400 })
    const hash = await sha256(value)
    const { error } = await admin.from('site_config')
      .upsert({ key: 'lockdown_pin_hash', value: hash, updated_by: profile.id, updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logActivity({ userId: profile.id, displayName: profile.display_name, action: 'update_lockdown_pin', request })
    return NextResponse.json({ ok: true })
  }

  const { error } = await admin.from('site_config')
    .upsert({ key, value: value ?? null, updated_by: profile.id, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (key === 'lockdown_mode') {
    await logActivity({
      userId: profile.id,
      displayName: profile.display_name,
      action: value === 'true' ? 'lockdown_enable' : 'lockdown_disable',
      request,
    })
  } else {
    await logActivity({
      userId: profile.id,
      displayName: profile.display_name,
      action: 'update_config',
      metadata: { key, value },
      request,
    })
  }

  return NextResponse.json({ ok: true })
}
