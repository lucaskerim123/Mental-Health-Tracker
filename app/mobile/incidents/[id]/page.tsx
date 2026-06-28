import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { incidentLabel, visibleIncidentText } from '@/lib/visibility'

export default async function MobileIncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/mobile/login?next=/mobile/incidents')

  const supabase = await createClient()
  const { data: incident } = await supabase.from('mental_health_incidents').select('*').eq('id', id).single()
  if (!incident) notFound()

  const safeIncident = incident

  const people = Array.isArray(safeIncident.people_involved) ? safeIncident.people_involved : []

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-md px-4 pb-6 pt-5">
        <header className="mb-5 flex items-center gap-3">
          <Link href="/mobile/incidents" className="rounded-full border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600">{incidentLabel(safeIncident)}</p>
            <h1 className="text-2xl font-semibold text-zinc-100">SEV {safeIncident.severity}</h1>
          </div>
        </header>

        <section className="mb-4 rounded-[2rem] border border-red-900/50 bg-red-950/20 p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-red-300/70">What happened</p>
          <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-zinc-100">{visibleIncidentText(profile.role, safeIncident, 'description', safeIncident.description)}</p>
        </section>

        <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">When</p>
          <p className="mt-2 text-sm font-mono text-zinc-300">{formatDateTime(safeIncident.occurred_at)}</p>
        </section>

        {people.length > 0 && (
          <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">People involved</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {people.map((person: string) => <span key={person} className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-mono text-zinc-300">{person}</span>)}
            </div>
          </section>
        )}

        <section className="mb-4 grid grid-cols-2 gap-3">
          <Status label="Police" active={safeIncident.police_called} />
          <Status label="Ambulance" active={safeIncident.ambulance_called} />
          <Status label="Arrest" active={safeIncident.was_arrested} />
          <Status label="Sectioned" active={safeIncident.was_sectioned} />
        </section>

        {safeIncident.substance_use && (
          <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Substance use</p>
            <p className="mt-2 text-sm font-mono text-zinc-300">{safeIncident.substance_use}</p>
          </section>
        )}

        {visibleIncidentText(profile.role, safeIncident, 'personal_notes', safeIncident.personal_notes) && (
          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Private note</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{visibleIncidentText(profile.role, safeIncident, 'personal_notes', safeIncident.personal_notes)}</p>
          </section>
        )}
      </div>
    </main>
  )
}

function Status({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded-[1.25rem] border px-4 py-3 ${active ? 'border-red-900/50 bg-red-950/20 text-red-200' : 'border-zinc-800 bg-zinc-950 text-zinc-600'}`}>
      <p className="text-[10px] font-mono uppercase tracking-widest">{label}</p>
      <p className="mt-1 text-sm font-semibold">{active ? 'Yes' : 'No'}</p>
    </div>
  )
}
