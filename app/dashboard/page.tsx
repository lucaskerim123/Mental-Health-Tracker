import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import { formatDate, daysUp } from '@/lib/utils'
import { Activity, Pill } from 'lucide-react'
import Link from 'next/link'
import { incidentLabel, visibleIncidentText } from '@/lib/incidents'
import { sessionLabel } from '@/lib/sessions'
import type { MentalHealthIncident } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: incidents }, { data: sessions }, { data: configRows }] = await Promise.all([
    supabase.from('mental_health_incidents').select('*').order('occurred_at', { ascending: false }).limit(5),
    supabase.from('drug_tracker_sessions').select('*').order('created_at', { ascending: false }).limit(5),
    profile.role === 'admin'
      ? admin.from('site_config').select('key, value').in('key', ['lockdown_mode', 'lockdown_pin_hash'])
      : Promise.resolve({ data: [] as { key: string; value: string | null }[] }),
  ])

  const ongoingSession = sessions?.find(s => !s.date_end) ?? null
  const config = Object.fromEntries((configRows ?? []).map(r => [r.key, r.value ?? '']))
  const lockdownActive = config.lockdown_mode === 'true'
  const hasPin = !!config.lockdown_pin_hash
  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-6xl mx-auto px-4 py-8 min-w-0 overflow-hidden">
        <div className="mb-8 min-w-0">
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase break-words [overflow-wrap:anywhere]">Dashboard</h1>
          <p className="text-xs text-zinc-600 font-mono mt-1 break-words [overflow-wrap:anywhere]">{formatDate(new Date().toISOString())}</p>
        </div>

        {ongoingSession && (
          <Link href={`/tracker/${ongoingSession.id}`} className="block min-w-0 max-w-full">
            <div className="border border-amber-900/40 bg-amber-950/10 p-4 mb-6 flex items-start justify-between gap-3 hover:border-amber-700/40 transition-colors min-w-0 max-w-full overflow-hidden">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Pill className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-amber-600 tracking-wide break-words [overflow-wrap:anywhere]">Active {sessionLabel(ongoingSession)}</p>
                  <p className="text-sm font-mono text-zinc-300 break-words [overflow-wrap:anywhere]">Day {daysUp(ongoingSession.date_start)} - {ongoingSession.sleep_hours}h sleep recorded</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-700 tracking-widest uppercase shrink-0">View →</span>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
          <div className="border border-zinc-800 bg-zinc-950 p-5 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="w-3.5 h-3.5 text-red-800 shrink-0" />
                <span className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 break-words [overflow-wrap:anywhere]">Recent Incidents</span>
              </div>
              {profile.role === 'admin' && (
                <Link href="/incidents/new" className="shrink-0 text-[10px] font-mono text-red-800 hover:text-red-600 tracking-widest">+ NEW</Link>
              )}
            </div>
            {incidents?.length ? (
              <div className="space-y-2 min-w-0">
                {(incidents as MentalHealthIncident[]).map(inc => (
                  <Link key={inc.id} href={`/incidents/${inc.id}`} className="block min-w-0 max-w-full">
                    <div className="border border-zinc-800 hover:border-zinc-700 px-3 py-2.5 transition-colors min-w-0 max-w-full overflow-hidden">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <span className="min-w-0 text-xs font-mono text-zinc-400 break-words [overflow-wrap:anywhere]">{incidentLabel(inc)} - {formatDate(inc.occurred_at)}</span>
                        <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 ${inc.severity >= 7 ? 'text-red-700 bg-red-950/30' : inc.severity >= 4 ? 'text-amber-700 bg-amber-950/30' : 'text-zinc-500 bg-zinc-800'}`}>SEV {inc.severity}</span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono mt-1 line-clamp-2 break-words [overflow-wrap:anywhere]">
                        {visibleIncidentText(profile.role, inc, 'brief_summary', inc.brief_summary) ?? 'No summary recorded.'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-700 font-mono">No incidents recorded.</p>
            )}
          </div>

          <div className="border border-zinc-800 bg-zinc-950 p-5 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Pill className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                <span className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 break-words [overflow-wrap:anywhere]">Session Tracker</span>
              </div>
              {profile.role === 'admin' && (
                <Link href="/tracker/new" className="shrink-0 text-[10px] font-mono text-amber-800 hover:text-amber-600 tracking-widest">+ NEW</Link>
              )}
            </div>
            {sessions?.length ? (
              <div className="space-y-2 min-w-0">
                {sessions.map(s => (
                  <Link key={s.id} href={`/tracker/${s.id}`} className="block min-w-0 max-w-full">
                    <div className="border border-zinc-800 hover:border-zinc-700 px-3 py-2.5 transition-colors min-w-0 max-w-full overflow-hidden">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <span className="min-w-0 text-xs font-mono text-zinc-400 break-words [overflow-wrap:anywhere]">{sessionLabel(s)} - {formatDate(s.date_start)} {s.date_end ? `-> ${formatDate(s.date_end)}` : '-> ongoing'}</span>
                        <span className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 ${!s.date_end ? 'text-amber-700 bg-amber-950/30' : 'text-zinc-500 bg-zinc-800'}`}>DAY {daysUp(s.date_start, s.date_end)}</span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono mt-1 break-words [overflow-wrap:anywhere]">{s.sleep_hours}h sleep</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-700 font-mono">No sessions recorded.</p>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  )
}
