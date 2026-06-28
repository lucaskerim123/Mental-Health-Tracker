import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, TimerReset } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { daysUp, formatDate } from '@/lib/utils'
import { sessionLabel } from '@/lib/sessions'

export default async function MobileSessionsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/mobile/login?next=/mobile/sessions')

  const supabase = await createClient()
  const { data: sessions } = await supabase
    .from('drug_tracker_sessions')
    .select('id, session_number, date_start, date_end, sleep_hours, any_incidents')
    .order('date_start', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-md px-4 pb-6 pt-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/mobile" className="rounded-full border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600">Phone App</p>
              <h1 className="text-2xl font-semibold text-zinc-100">Session History</h1>
            </div>
          </div>
          <Link href="/mobile/session" className="rounded-full border border-amber-900/50 bg-amber-950/30 p-3 text-amber-300">
            <TimerReset className="h-4 w-4" />
          </Link>
        </header>

        <section className="space-y-3">
          {sessions?.length ? sessions.map(session => (
            <Link key={session.id} href={`/mobile/sessions/${session.id}`} className="block rounded-[1.75rem] border border-zinc-800 bg-zinc-950 p-4 active:scale-[0.99]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-zinc-500">{sessionLabel(session)} - {formatDate(session.date_start)}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-mono text-zinc-400">{session.date_end ? 'Closed' : 'Open'}</span>
              </div>
              <p className="text-2xl font-semibold text-zinc-100">Day {daysUp(session.date_start, session.date_end)}</p>
              <p className="mt-1 text-xs font-mono text-zinc-500">{session.sleep_hours}h sleep</p>
              {session.any_incidents && <p className="mt-3 line-clamp-2 text-xs font-mono text-zinc-400">{session.any_incidents}</p>}
            </Link>
          )) : (
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5 text-center text-sm font-mono text-zinc-600">
              No sessions yet.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
