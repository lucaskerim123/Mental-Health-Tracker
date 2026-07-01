import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import Link from 'next/link'
import { formatDate, daysUp } from '@/lib/utils'
import { sessionLabel } from '@/lib/sessions'

export default async function TrackerPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: sessions } = await supabase
    .from('drug_tracker_sessions')
    .select('*')
    .order('date_start', { ascending: false })

  const isAdmin = profile.role === 'admin'

  return (
    <AppShell userId={profile.id} role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-8 min-w-0">
          <h1 className="min-w-0 text-lg font-mono tracking-widest text-zinc-300 uppercase break-words [overflow-wrap:anywhere]">Session Tracker</h1>
          {isAdmin && (
            <Link href="/tracker/new" className="shrink-0 border border-amber-900/60 text-amber-800 hover:bg-amber-950/30 px-4 py-2 text-[11px] font-mono tracking-widest uppercase transition-colors">
              + New Session
            </Link>
          )}
        </div>
        <div className="space-y-2 min-w-0">
          {sessions?.map(s => (
            <div key={s.id} className="block min-w-0 max-w-full">
              <div className="min-w-0 max-w-full border border-zinc-800 hover:border-zinc-700 bg-zinc-950 px-4 py-4 flex items-start justify-between gap-3 transition-colors overflow-hidden">
                <Link href={`/tracker/${s.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                    <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase break-words [overflow-wrap:anywhere]">{sessionLabel(s)}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 tracking-widest uppercase ${!s.date_end ? 'text-amber-700 bg-amber-950/30 border border-amber-900/30' : 'text-zinc-500 bg-zinc-800 border border-zinc-700'}`}>
                      {!s.date_end ? `ONGOING - DAY ${daysUp(s.date_start)}` : `DAY ${daysUp(s.date_start, s.date_end)}`}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-zinc-500 break-words [overflow-wrap:anywhere]">{formatDate(s.date_start)} {s.date_end ? `to ${formatDate(s.date_end)}` : 'to present'}</p>
                </Link>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-zinc-400 whitespace-nowrap">{s.sleep_hours}h sleep</p>
                  <Link href={`/tracker/${s.id}/report`} className="mt-2 inline-block border border-amber-900/60 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-amber-700 hover:border-amber-700">
                    Report
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {!sessions?.length && <p className="text-sm text-zinc-700 font-mono py-8 text-center">No sessions recorded.</p>}
        </div>
      </main>
    </AppShell>
  )
}
