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
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">Session Tracker</h1>
          {isAdmin && (
            <Link href="/tracker/new" className="border border-amber-900/60 text-amber-800 hover:bg-amber-950/30 px-4 py-2 text-[11px] font-mono tracking-widest uppercase transition-colors">
              + New Session
            </Link>
          )}
        </div>
        <div className="space-y-2">
          {sessions?.map(s => (
            <Link key={s.id} href={`/tracker/${s.id}`}>
              <div className="border border-zinc-800 hover:border-zinc-700 bg-zinc-950 px-4 py-4 flex items-center justify-between transition-colors">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase">{sessionLabel(s)}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 tracking-widest uppercase ${!s.date_end ? 'text-amber-700 bg-amber-950/30 border border-amber-900/30' : 'text-zinc-500 bg-zinc-800 border border-zinc-700'}`}>
                      {!s.date_end ? `ONGOING – DAY ${daysUp(s.date_start)}` : `DAY ${daysUp(s.date_start, s.date_end)}`}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-zinc-500">{formatDate(s.date_start)} {s.date_end ? `→ ${formatDate(s.date_end)}` : '→ present'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-zinc-400">{s.sleep_hours}h sleep</p>
                  {s.any_incidents && <p className="text-[10px] font-mono text-red-800 mt-0.5">Incidents</p>}
                </div>
              </div>
            </Link>
          ))}
          {!sessions?.length && <p className="text-sm text-zinc-700 font-mono py-8 text-center">No sessions recorded.</p>}
        </div>
      </main>
    </AppShell>
  )
}
