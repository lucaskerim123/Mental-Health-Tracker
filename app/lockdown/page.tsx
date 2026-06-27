import { createAdminClient } from '@/lib/supabase/admin'
import LockdownDisplay from './LockdownDisplay'

export const dynamic = 'force-dynamic'

export default async function LockdownPage() {
  const admin = createAdminClient()
  const { data: rows } = await admin.from('site_config').select('key, value')
    .in('key', ['site_name', 'lockdown_message'])

  const cfg = Object.fromEntries((rows ?? []).map(r => [r.key, r.value ?? '']))
  return (
    <LockdownDisplay
      siteName={cfg.site_name ?? 'Mental Health Tracker'}
      message={cfg.lockdown_message ?? 'This site is temporarily unavailable.'}
    />
  )
}
