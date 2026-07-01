import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth'
import LockdownDisplay from './LockdownDisplay'

export const dynamic = 'force-dynamic'

export default async function LockdownPage() {
  const profile = await getProfile()
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('site_config')
    .select('key, value')
    .in('key', ['site_name', 'lockdown_message'])

  const cfg = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value ?? '']))

  const siteName = cfg.site_name ?? 'Mental Health Tracker'
  const message = cfg.lockdown_message ?? 'Site is on lockdown.'
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  return <LockdownDisplay siteName={siteName} message={message} isAdmin={isAdmin} />
}  
