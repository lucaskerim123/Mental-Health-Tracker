import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import NewIncidentForm from './NewIncidentForm'
import AppShell from '@/components/layout/AppShell'

export default async function NewIncidentPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin' && profile.role !== 'owner') redirect('/incidents')

  const supabase = await createClient()
  const { data: trackerSessions } = await supabase
    .from('drug_tracker_sessions')
    .select('id, session_number, date_start, date_end')
    .order('date_start', { ascending: false })

  return (
    <AppShell userId={profile.id} role={profile.role} displayName={profile.display_name}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase mb-8">New Incident</h1>
        <NewIncidentForm trackerSessions={trackerSessions ?? []} />
      </main>
    </AppShell>
  )
}
