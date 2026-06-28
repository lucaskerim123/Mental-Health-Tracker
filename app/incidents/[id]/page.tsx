import { redirect, notFound } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import IncidentDetail from './IncidentDetail'

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [{ data: incident }, { data: trackerSessions }] = await Promise.all([
    supabase.from('mental_health_incidents').select('*').eq('id', id).single(),
    supabase.from('drug_tracker_sessions').select('id, session_number, date_start, date_end').order('date_start', { ascending: false }),
  ])

  if (!incident) notFound()

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <IncidentDetail
          incident={incident}
          role={profile.role}
          isAdmin={profile.role === 'admin'}
          trackerSessions={trackerSessions ?? []}
        />
      </main>
    </AppShell>
  )
}
