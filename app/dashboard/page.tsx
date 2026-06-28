import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
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

  const [{ data: incidents }, { data: sessions }] = await Promise.all([
    supabase.from('mental_health_incidents').select('*').order('occurred_at', { ascending: false }).limit(5),
    supabase.from('drug_tracker_sessions').select('*').order('created_at', { ascending: false }).limit(5),
  ])

  const ongoingSession = sessions?.find(s => !s.date_end) ?? null
  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">Dashboard</h1>
          <p className="text-xs text-zinc-600 font-mono mt-1">{formatDate(new Date().toISOString())}</p>
        </div>

        {ongoingSession && (
          <Link href={`/tracker/${ongoingSession.id}`}>
            <div className="border border-amber-900/40 bg-amber-950/10 p-4 mb-6 flex items-center justify-between hover:border-amber-700/40 transition-colors">
              <div className="flex items-center gap-3">
                <Pill className="w-4 h-4 text-amber-700" />
                <div>
                  <p className="text-xs font-mono text-amber-600 tracking-wide">Active {sessionLabel(ongoingSession)}</p>
                  <p className="text-sm font-mono text-zinc-300">Day {daysUp(ongoingSession.date_start)} - {ongoingSession.sleep_hours}h sleep recorded</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-700 tracking-widest uppercase">View →</span>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-red-800" />
                <span className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Recent Incidents</span>
              </div>
              {profile.role === 'admin' && (
                <Link href="/incidents/new" className="text-[10px] font-mono text-red-800 hover:text-red-600 tracking-widest">+ NEW</Link>
              )}
            </div>
            {incidents?.length ? (
              <div className="space-y-2">
                {(incidents as MentalHealthIncident[]).map(inc => (
                  <Link key={inc.id} href={`/incidents/${inc.id}`}>
                    <div className="border border-zinc-800 hover:border-zinc-700 px-3 py-2.5 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-zinc-400">{incidentLabel(inc)} - {formatDate(inc.occurred_at)}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 ${inc.severity >= 7 ? 'text-red-700 bg-red-950/30' : inc.severity >= 4 ? 'text-amber-700 bg-amber-950/30' : 'text-zinc-500 bg-zinc-800'}`}>SEV {inc.severity}</span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono mt-1 truncate">
                        {visibleIncidentText(profile.role, inc, 'description', inc.description)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-700 font-mono">No incidents recorded.</p>
            )}
          </div>

          <div className="border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pill className="w-3.5 h-3.5 text-amber-800" />
                <span className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Session Tracker</span>
              </div>
              {profile.role === 'admin' && (
                <Link href="/tracker/new" className="text-[10px] font-mono text-amber-800 hover:text-amber-600 tracking-widest">+ NEW</Link>
              )}
            </div>
            {sessions?.length ? (
              <div className="space-y-2">
                {sessions.map(s => (
                  <Link key={s.id} href={`/tracker/${s.id}`}>
                    <div className="border border-zinc-800 hover:border-zinc-700 px-3 py-2.5 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-zinc-400">{sessionLabel(s)} - {formatDate(s.date_start)} {s.date_end ? `-> ${formatDate(s.date_end)}` : '-> ongoing'}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 ${!s.date_end ? 'text-amber-700 bg-amber-950/30' : 'text-zinc-500 bg-zinc-800'}`}>DAY {daysUp(s.date_start, s.date_end)}</span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono mt-1">{s.sleep_hours}h sleep · {s.any_incidents ? 'Incidents logged' : 'No incidents'}</p>
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
