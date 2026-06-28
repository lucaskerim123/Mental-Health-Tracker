import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { REDACTED, canViewIncidentField, incidentLabel, visibleIncidentList, visibleIncidentText } from '@/lib/incidents'
import type { MentalHealthIncident } from '@/lib/supabase/types'

export default async function MobileIncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/mobile/login?next=/mobile/incidents')

  const supabase = await createClient()
  const { data } = await supabase.from('mental_health_incidents').select('*').eq('id', id).single()
  if (!data) notFound()

  const incident = data as MentalHealthIncident
  const people = visibleIncidentList(profile.role, incident, 'people_involved', incident.people_involved)

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-md px-4 pb-6 pt-5">
        <header className="mb-5 flex items-center gap-3">
          <Link href="/mobile/incidents" className="rounded-full border border-zinc-800 bg-zinc-950 p-3 text-zinc-400">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600">{incidentLabel(incident)}</p>
            <h1 className="text-2xl font-semibold text-zinc-100">SEV {incident.severity}</h1>
          </div>
        </header>

        <MobileText label="What happened" red value={visibleIncidentText(profile.role, incident, 'description', incident.description)} restricted={!canViewIncidentField(profile.role, incident, 'description')} />

        <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">When</p>
          <p className="mt-2 text-sm font-mono text-zinc-300">{formatDateTime(incident.occurred_at)}</p>
        </section>

        <MobileText label="Location" value={visibleIncidentText(profile.role, incident, 'location', incident.location)} restricted={!canViewIncidentField(profile.role, incident, 'location')} />

        {people && (
          <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Who was involved</p>
            {people === REDACTED ? (
              <p className="mt-3 text-sm font-mono text-zinc-300">{REDACTED}</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {people.map(person => <span key={person} className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-mono text-zinc-300">{person}</span>)}
              </div>
            )}
          </section>
        )}

        <section className="mb-4 grid grid-cols-2 gap-3">
          <Status label="Police" active={incident.police_called} />
          <Status label="Ambulance" active={incident.ambulance_called} />
          <Status label="Arrest" active={incident.was_arrested} />
          <Status label="Sectioned" active={incident.was_sectioned} />
        </section>

        {incident.substance_use && (
          <section className="mb-4 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Substance use</p>
            <p className="mt-2 text-sm font-mono text-zinc-300">{incident.substance_use}</p>
          </section>
        )}

        <MobileText label="Notes" value={visibleIncidentText(profile.role, incident, 'notes', incident.notes)} restricted={!canViewIncidentField(profile.role, incident, 'notes')} />
        <MobileText label="Private note" value={visibleIncidentText(profile.role, incident, 'personal_notes', incident.personal_notes)} restricted={!canViewIncidentField(profile.role, incident, 'personal_notes')} />
        <MobileText label="Counsellor/lawyer note" value={visibleIncidentText(profile.role, incident, 'professional_note', incident.professional_note)} restricted={!canViewIncidentField(profile.role, incident, 'professional_note')} />
        <MobileText label="Outcome" value={visibleIncidentText(profile.role, incident, 'outcome', incident.outcome)} restricted={!canViewIncidentField(profile.role, incident, 'outcome')} />
      </div>
    </main>
  )
}

function MobileText({ label, value, restricted, red = false }: { label: string; value: string | null; restricted: boolean; red?: boolean }) {
  if (!value) return null
  return (
    <section className={`mb-4 rounded-[2rem] border p-5 ${red ? 'border-red-900/50 bg-red-950/20' : 'border-zinc-800 bg-zinc-950'}`}>
      <div className="flex items-center gap-2">
        <p className={`text-[10px] font-mono uppercase tracking-widest ${red ? 'text-red-300/70' : 'text-zinc-600'}`}>{label}</p>
        {restricted && <span className="text-[9px] font-mono uppercase tracking-widest text-red-700">Restricted</span>}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-zinc-100">{value}</p>
    </section>
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
