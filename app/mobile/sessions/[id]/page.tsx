import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, TimerReset } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { daysUp, formatDate, formatDateTime } from '@/lib/utils'

export default async function MobileSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/mobile/login?next=/mobile/sessions')

  const supabase = await createClient()
  const [
    { data: session },
    { data: sleepLog },
    { data: drugUseLog },
    { data: linkedIncidents },
  ] = await Promise.all([
    supabase.from('drug_tracker_sessions').select('*').eq('id', id).single(),
    supabase.from('sleep_log').select('*').eq('session_id', id).order('logged_at', { ascending: false }).limit(10),
    supabase.from('drug_use_log').select('*').eq('session_id', id).order('logged_at', { ascending: false }).limit(10),
    supabase.from('mental_health_incidents').select('id, occurred_at, severity, description').eq('tracker_session_id', id).order('occurred_at', { ascending: false }).limit(10),
  ])

  if (!session) notFound()

  const canViewSensitive = profile.role !== 'viewer'
  const sensitiveFieldMask = !canViewSensitive
    ? Object.fromEntries((session.sensitive_fields ?? []).map((field: string) => [field, null]))
    : {}
  const safeSession = canViewSensitive ? session : {
    ...session,
    personal_reflection: null,
    ...(session.is_sensitive ? { any_incidents: null, notes: null } : {}),
    ...sensitiveFieldMask,
  }

  const isOpen = !safeSession.date_end

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-md px-4 pb-6 pt-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/mobile/sessions" className="rounded-full border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600">Session</p>
              <h1 className="text-2xl font-semibold text-zinc-100">Day {daysUp(safeSession.date_start, safeSession.date_end)}</h1>
            </div>
          </div>
          {isOpen && (
            <Link href="/mobile/session" className="rounded-full border border-amber-900/50 bg-amber-950/30 p-3 text-amber-300">
              <TimerReset className="h-4 w-4" />
            </Link>
          )}
        </header>

        <section className="mb-4 rounded-[2rem] border border-amber-900/50 bg-amber-950/20 p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-300/70">Status</p>
          <p className="mt-3 text-4xl font-semibold text-zinc-100">{isOpen ? 'Open' : 'Closed'}</p>
          <p className="mt-2 text-xs font-mono text-zinc-500">Started {formatDate(safeSession.date_start)}{safeSession.date_end ? ` · Ended ${formatDate(safeSession.date_end)}` : ''}</p>
        </section>

        <section className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-[1.25rem] border border-zinc-800 bg-zinc-950 px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Sleep</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{safeSession.sleep_hours}h</p>
          </div>
          <div className="rounded-[1.25rem] border border-zinc-800 bg-zinc-950 px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Incidents</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{linkedIncidents?.length ?? 0}</p>
          </div>
        </section>

        {safeSession.notes && (
          <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Session note</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{safeSession.notes}</p>
          </section>
        )}

        {safeSession.any_incidents && (
          <section className="mb-4 rounded-[2rem] border border-red-900/40 bg-red-950/10 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-red-300/70">Any incidents</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{safeSession.any_incidents}</p>
          </section>
        )}

        {canViewSensitive && safeSession.personal_reflection && (
          <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Private reflection</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{safeSession.personal_reflection}</p>
          </section>
        )}

        <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-zinc-600">Sleep log</p>
          <div className="space-y-2">
            {sleepLog?.length ? sleepLog.map(log => (
              <div key={log.id} className="flex justify-between rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-xs font-mono text-zinc-400">
                <span>+{log.hours_added}h</span>
                <span>{formatDateTime(log.logged_at)}</span>
              </div>
            )) : <p className="py-2 text-xs font-mono text-zinc-700">No sleep entries.</p>}
          </div>
        </section>

        {canViewSensitive && (
          <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-zinc-600">Usage log</p>
            <div className="space-y-2">
              {drugUseLog?.length ? drugUseLog.map(entry => (
                <div key={entry.id} className="rounded-2xl border border-zinc-800 bg-black px-4 py-3">
                  <div className="flex justify-between gap-2 text-xs font-mono text-zinc-300">
                    <span>{entry.substance}</span>
                    <span>{entry.amount ?? ''} {entry.unit ?? ''}</span>
                  </div>
                  {entry.notes && <p className="mt-2 text-xs font-mono text-zinc-500">{entry.notes}</p>}
                </div>
              )) : <p className="py-2 text-xs font-mono text-zinc-700">No usage entries.</p>}
            </div>
          </section>
        )}

        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-zinc-600">Linked incidents</p>
          <div className="space-y-2">
            {linkedIncidents?.length ? linkedIncidents.map(incident => (
              <Link key={incident.id} href={`/mobile/incidents/${incident.id}`} className="block rounded-2xl border border-zinc-800 bg-black px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">{formatDate(incident.occurred_at)}</span>
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-mono text-zinc-400">SEV {incident.severity}</span>
                </div>
                <p className="mt-1 truncate text-xs font-mono text-zinc-400">{incident.description}</p>
              </Link>
            )) : <p className="py-2 text-xs font-mono text-zinc-700">No linked incidents.</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
