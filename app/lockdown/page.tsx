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
  const cfg = Object.fromEntries((rows ?? []).map(r => [r.key, r.value]))
  const siteName = cfg.site_name ?? 'Mental Health Tracker'
  const message = cfg.lockdown_message ?? 'This site is temporarily unavailable.'

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <p className="text-zinc-600 font-mono text-[10px] tracking-widest uppercase">{siteName}</p>
        <p className="text-zinc-400 font-mono text-sm">{message}</p>
        <a href="/unlock" className="block text-zinc-700 hover:text-zinc-500 font-mono text-[10px] tracking-widest uppercase transition-colors">
          Emergency Unlock
        </a>
      </div>
    </div>
  )
}
