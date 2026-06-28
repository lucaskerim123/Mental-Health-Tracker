import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, FileText, Plus, TimerReset } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { daysUp, formatDate, formatDateTime } from '@/lib/utils'

export default async function MobileHomePage() {
  const profile = await getProfile()
  if (!profile) redirect('/mobile/login?next=/mobile')

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
      .select('id, occurred_at, severity, description')
      .order('occurred_at', { ascending: false })
      .limit(3),
    supabase
      .from('drug_tracker_sessions')
      .select('id, date_start, date_end, sleep_hours')
      .order('date_start', { ascending: false })
      .limit(3),
  ])

  const activeSession = activeSessions?.[0] ?? null
  const isAdmin = profile.role === 'admin'

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-6 pt-5">
        <header className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 px-5 py-4 shadow-2xl shadow-black">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-zinc-600">Phone App</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">Quick Control</h1>
            </div>
            <div className="rounded-full border border-red-900/50 bg-red-950/20 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-red-300">
              Private
            </div>
          </div>
          <p className="mt-3 text-xs font-mono text-zinc-600">{formatDateTime(new Date().toISOString())}</p>
        </header>

        <Link href="/mobile/session" className="mb-4 block rounded-[2rem] border border-amber-900/50 bg-gradient-to-br from-amber-950/40 to-zinc-950 px-5 py-5 active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-amber-600">Session Tracker</p>
              {activeSession ? (
                <>
                  <p className="mt-2 text-5xl font-semibold tracking-tight text-zinc-100">Day {daysUp(activeSession.date_start)}</p>
                  <p className="mt-2 text-xs font-mono text-zinc-500">Started {formatDate(activeSession.date_start)} · {activeSession.sleep_hours}h sleep</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold text-zinc-100">No active session</p>
                  <p className="mt-2 text-xs font-mono text-zinc-600">Tap to start tracking.</p>
                </>
              )}
            </div>
            <TimerReset className="mt-1 h-6 w-6 text-amber-700" />
          </div>
        </Link>

        <section className="mb-5 grid grid-cols-1 gap-3">
          {isAdmin && (
            <Link href="/mobile/incident" className="flex items-center justify-between rounded-[1.75rem] border border-red-900/50 bg-red-950/20 px-5 py-4 active:scale-[0.99]">
              <div>
                <p className="text-lg font-semibold text-zinc-100">Add Incident</p>
                <p className="mt-1 text-xs font-mono text-red-300/70">Fast log · severity · notes</p>
              </div>
              <Plus className="h-6 w-6 text-red-500" />
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Link href="/mobile/incidents" className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 px-4 py-4 active:scale-[0.99]">
              <AlertTriangle className="mb-3 h-5 w-5 text-zinc-500" />
              <p className="text-sm font-semibold text-zinc-200">Incidents</p>
              <p className="mt-1 text-[10px] font-mono text-zinc-600">Phone list</p>
            </Link>
            <Link href="/mobile/sessions" className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 px-4 py-4 active:scale-[0.99]">
              <FileText className="mb-3 h-5 w-5 text-zinc-500" />
              <p className="text-sm font-semibold text-zinc-200">History</p>
              <p className="mt-1 text-[10px] font-mono text-zinc-600">Sessions</p>
            </Link>
          </div>
        </section>

        <section className="mb-4 rounded-[1.75rem] border border-zinc-800 bg-zinc-950 px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Recent incidents</p>
            <Link href="/mobile/incidents" className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">All</Link>
          </div>
          <div className="space-y-2">
            {recentIncidents?.length ? recentIncidents.map(incident => (
              <Link key={incident.id} href={`/mobile/incidents/${incident.id}`} className="block rounded-2xl border border-zinc-800 bg-black px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">{formatDate(incident.occurred_at)}</span>
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-mono text-zinc-400">SEV {incident.severity}</span>
                </div>
                <p className="mt-1 truncate text-xs font-mono text-zinc-400">{incident.description}</p>
              </Link>
            )) : (
              <p className="py-3 text-center text-xs font-mono text-zinc-700">No incident entries.</p>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-zinc-800 bg-zinc-950 px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Recent sessions</p>
            <Link href="/mobile/sessions" className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">All</Link>
          </div>
          <div className="space-y-2">
            {recentSessions?.length ? recentSessions.map(session => (
              <Link key={session.id} href={`/mobile/sessions/${session.id}`} className="block rounded-2xl border border-zinc-800 bg-black px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">{formatDate(session.date_start)}</span>
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-mono text-zinc-400">{session.date_end ? 'Closed' : 'Open'}</span>
                </div>
                <p className="mt-1 text-xs font-mono text-zinc-400">{session.sleep_hours}h sleep · Day {daysUp(session.date_start, session.date_end)}</p>
              </Link>
            )) : (
              <p className="py-3 text-center text-xs font-mono text-zinc-700">No tracker sessions.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
