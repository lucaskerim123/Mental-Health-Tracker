import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'

export default async function IncidentsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: incidents } = await supabase
    .from('mental_health_incidents')
    .select('*')
    .order('occurred_at', { ascending: false })

  const canViewSensitive = profile.role !== 'viewer'
  const isAdmin = profile.role === 'admin'

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">Mental Health Incidents</h1>
          {isAdmin && (
            <Link href="/incidents/new" className="border border-red-900/60 text-red-800 hover:bg-red-950/30 px-4 py-2 text-[11px] font-mono tracking-widest uppercase transition-colors">
              + New Entry
            </Link>
          )}
        </div>
        <div className="space-y-2">
          {incidents?.map(inc => (
            <Link key={inc.id} href={`/incidents/${inc.id}`}>
              <div className="border border-zinc-800 hover:border-zinc-700 bg-zinc-950 px-4 py-3.5 flex items-center justify-between transition-colors">
                <div>
                  <p className="text-xs font-mono text-zinc-500">{formatDateTime(inc.occurred_at)}</p>
                  <p className="text-sm font-mono text-zinc-300 mt-0.5 truncate max-w-md">
                    {inc.is_sensitive && !canViewSensitive ? '[Restricted — insufficient clearance]' : inc.description}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {inc.is_sensitive && <span className="text-[9px] font-mono text-red-800 tracking-widest uppercase">Sensitive</span>}
                  <span className={`text-[10px] font-mono px-2 py-0.5 ${inc.severity >= 7 ? 'text-red-700 bg-red-950/40' : inc.severity >= 4 ? 'text-amber-700 bg-amber-950/40' : 'text-zinc-500 bg-zinc-800'}`}>
                    SEV {inc.severity}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {!incidents?.length && <p className="text-sm text-zinc-700 font-mono py-8 text-center">No incidents recorded.</p>}
        </div>
      </main>
    </AppShell>
  )
}
