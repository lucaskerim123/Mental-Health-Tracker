import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export default async function MobileIncidentsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login?next=/mobile/incidents')

  const isAdmin = profile.role === 'admin'
  const supabase = await createClient()
  const { data: incidents } = await supabase
    .from('mental_health_incidents')
    .select('id, occurred_at, severity, description, police_called, ambulance_called, was_arrested, was_sectioned')
    .order('occurred_at', { ascending: false })
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
              <h1 className="text-2xl font-semibold text-zinc-100">Incidents</h1>
            </div>
          </div>
          {isAdmin && (
            <Link href="/mobile/incident" className="rounded-full border border-red-900/50 bg-red-950/30 p-3 text-red-300">
              <Plus className="h-4 w-4" />
            </Link>
          )}
        </header>

        <section className="space-y-3">
          {incidents?.length ? incidents.map(incident => (
            <Link key={incident.id} href={`/mobile/incidents/${incident.id}`} className="block rounded-[1.75rem] border border-zinc-800 bg-zinc-950 p-4 active:scale-[0.99]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-zinc-500">{formatDate(incident.occurred_at)}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-mono text-zinc-400">SEV {incident.severity}</span>
              </div>
              <p className="line-clamp-3 text-sm font-mono text-zinc-300">{incident.description}</p>
              {(incident.police_called || incident.ambulance_called || incident.was_arrested || incident.was_sectioned) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.police_called && <span className="rounded-full border border-red-900/40 px-2 py-1 text-[10px] font-mono text-red-300">Police</span>}
                  {incident.ambulance_called && <span className="rounded-full border border-amber-900/40 px-2 py-1 text-[10px] font-mono text-amber-300">Ambulance</span>}
                  {incident.was_arrested && <span className="rounded-full border border-red-900/40 px-2 py-1 text-[10px] font-mono text-red-300">Arrest</span>}
                  {incident.was_sectioned && <span className="rounded-full border border-amber-900/40 px-2 py-1 text-[10px] font-mono text-amber-300">Sectioned</span>}
                </div>
              )}
            </Link>
          )) : (
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5 text-center text-sm font-mono text-zinc-600">
              No incident entries.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
