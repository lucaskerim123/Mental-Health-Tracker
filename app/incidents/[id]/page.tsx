import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import IncidentDetail from './IncidentDetail'
import type { MentalHealthIncident } from '@/lib/supabase/types'

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [{ data: incident }, { data: trackerSessions }, { data: documents }] = await Promise.all([
    supabase.from('mental_health_incidents').select('*').eq('id', id).single(),
    supabase.from('drug_tracker_sessions').select('id, session_number, date_start, date_end').order('date_start', { ascending: false }),
    supabase.from('documents').select('*').eq('attached_to_type', 'incident').eq('attached_to_id', id).order('created_at', { ascending: false }),
  ])

  if (!incident) notFound()

  return (
    <AppShell userId={profile.id} role={profile.role} displayName={profile.display_name}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="md:hidden mb-4">
          <Link href="/incidents" className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 transition-colors">
            Back to incidents
          </Link>
        </div>
        <IncidentDetail
          incident={incident as MentalHealthIncident}
          role={profile.role}
          isAdmin={profile.role === 'admin'}
          trackerSessions={trackerSessions ?? []}
          documents={documents ?? []}
          userId={profile.id}
        />
      </main>
    </AppShell>
  )
}

