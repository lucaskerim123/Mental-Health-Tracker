import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import QuickSessionPanel from './QuickSessionPanel'

export default async function MobileSessionPage() {
  const profile = await getProfile()
  if (!profile) redirect('/mobile/login?next=/mobile/session')

  const isAdmin = profile.role === 'admin'
  const supabase = await createClient()
  const [{ data: activeSessions }, { data: recentSessions }] = await Promise.all([
    supabase
      .from('drug_tracker_sessions')
      .select('id, session_number, date_start, date_end, sleep_hours, any_incidents, notes')
      .is('date_end', null)
      .order('date_start', { ascending: false })
      .limit(1),
    supabase
      .from('drug_tracker_sessions')
      .select('id, session_number, date_start, date_end, sleep_hours')
      .order('date_start', { ascending: false })
      .limit(5),
  ])

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-md px-4 pb-6 pt-5">
        <header className="mb-5 flex items-center gap-3">
          <Link href="/mobile" className="rounded-full border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600">Phone App</p>
            <h1 className="text-2xl font-semibold text-zinc-100">Session Tracker</h1>
          </div>
        </header>

        {isAdmin ? (
          <QuickSessionPanel activeSession={activeSessions?.[0] ?? null} recentSessions={recentSessions ?? []} />
        ) : (
          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-sm font-mono text-zinc-500">You do not have permission to manage sessions.</p>
          </section>
        )}
      </div>
    </main>
  )
}
