import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Activity, ClipboardList, Plus, Shield, TimerReset } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { daysUp, formatDate, formatDateTime } from '@/lib/utils'

export default async function MobileHomePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [{ data: activeSessions }, { data: recentIncidents }, { data: recentSessions }] = await Promise.all([
    supabase
      .from('drug_tracker_sessions')
      .select('id, date_start, date_end, sleep_hours, any_incidents')
      .is('date_end', null)
      .order('date_start', { ascending: false })
      .limit(1),
    supabase
      .from('mental_health_incidents')
      .select('id, occurred_at, severity, description, is_sensitive')
      .order('occurred_at', { ascending: false })
      .limit(3),
    supabase
      .from('drug_tracker_sessions')
      .select('id, date_start, date_end, sleep_hours, any_incidents')
      .order('date_start', { ascending: false })
      .limit(3),
  ])

  const activeSession = activeSessions?.[0] ?? null
  const isAdmin = profile.role === 'admin'

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="mx-auto max-w-md px-4 py-5 pb-10">
        <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Shield className="h-4 w-4 text-red-700" />
            <p className="text-[10px] font-mono uppercase tracking-[0.28em]">Mental Health Tracker</p>
          </div>
          <h1 className="mt-3 text-2xl font-mono font-semibold text-zinc-100">Today</h1>
          <p className="mt-1 text-xs font-mono text-zinc-600">{formatDateTime(new Date().toISOString())}</p>
        </section>

        <section className="mb-5 rounded-2xl border border-amber-900/40 bg-amber-950/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-amber-700">Session</p>
              {activeSession ? (
                <>
                  <p className="mt-2 text-lg font-mono text-zinc-100">Day {daysUp(activeSession.date_start)}</p>
                  <p className="mt-1 text-xs font-mono text-zinc-500">Started {formatDate(activeSession.date_start)} · {activeSession.sleep_hours}h sleep</p>
                </>
              ) : (
                <p className="mt-2 text-sm font-mono text-zinc-500">No active session.</p>
              )}
            </div>
            <TimerReset className="mt-1 h-5 w-5 text-amber-800" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {activeSession ? (
              <Link href={`/tracker/${activeSession.id}`} className="rounded-xl border border-amber-900/50 px-3 py-3 text-center text-[11px] font-mono uppercase tracking-widest text-amber-300">
                Open Session
              </Link>
            ) : isAdmin ? (
              <Link href="/tracker/new" className="rounded-xl border border-amber-900/50 px-3 py-3 text-center text-[11px] font-mono uppercase tracking-widest text-amber-300">
                Start Session
              </Link>
            ) : (
              <Link href="/tracker" className="rounded-xl border border-zinc-800 px-3 py-3 text-center text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                Sessions
              </Link>
            )}
            <Link href="/tracker" className="rounded-xl border border-zinc-800 px-3 py-3 text-center text-[11px] font-mono uppercase tracking-widest text-zinc-400">
              History
            </Link>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3">
          {isAdmin && (
            <Link href="/incidents/new" className="rounded-2xl border border-red-900/50 bg-red-950/10 p-4">
              <Plus className="mb-3 h-5 w-5 text-red-700" />
              <p className="text-sm font-mono text-zinc-100">Add Incident</p>
              <p className="mt-1 text-[10px] font-mono text-zinc-600">Entry + details</p>
            </Link>
          )}
          {isAdmin && (
            <Link href="/tracker/new" className="rounded-2xl border border-amber-900/50 bg-amber-950/10 p-4">
              <Plus className="mb-3 h-5 w-5 text-amber-700" />
              <p className="text-sm font-mono text-zinc-100">New Session</p>
              <p className="mt-1 text-[10px] font-mono text-zinc-600">Start tracker</p>
            </Link>
          )}
          <Link href="/incidents" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <Activity className="mb-3 h-5 w-5 text-zinc-500" />
            <p className="text-sm font-mono text-zinc-100">Incidents</p>
            <p className="mt-1 text-[10px] font-mono text-zinc-600">View entries</p>
          </Link>
          <Link href="/tracker" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <ClipboardList className="mb-3 h-5 w-5 text-zinc-500" />
            <p className="text-sm font-mono text-zinc-100">Sessions</p>
            <p className="mt-1 text-[10px] font-mono text-zinc-600">Sleep + notes</p>
          </Link>
        </section>

        <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Recent Incidents</p>
            <Link href="/incidents" className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">All</Link>
          </div>
          <div className="space-y-2">
            {recentIncidents?.length ? recentIncidents.map(incident => (
              <Link key={incident.id} href={`/incidents/${incident.id}`} className="block rounded-xl border border-zinc-800 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">{formatDate(incident.occurred_at)}</span>
                  <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-400">SEV {incident.severity}</span>
                </div>
                <p className="mt-1 truncate text-xs font-mono text-zinc-400">{incident.description}</p>
              </Link>
            )) : (
              <p className="py-3 text-center text-xs font-mono text-zinc-700">No incident entries.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Recent Sessions</p>
            <Link href="/tracker" className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">All</Link>
          </div>
          <div className="space-y-2">
            {recentSessions?.length ? recentSessions.map(session => (
              <Link key={session.id} href={`/tracker/${session.id}`} className="block rounded-xl border border-zinc-800 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">{formatDate(session.date_start)}</span>
                  <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-400">{session.date_end ? 'Closed' : 'Open'}</span>
                </div>
                <p className="mt-1 text-xs font-mono text-zinc-400">{session.sleep_hours}h sleep · Day {daysUp(session.date_start, session.date_end)}</p>
              </Link>
            )) : (
              <p className="py-3 text-center text-xs font-mono text-zinc-700">No tracker sessions.</p>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  )
}
