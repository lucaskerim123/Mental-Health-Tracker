import { redirect, notFound } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import TrackerDetail from './TrackerDetail'

export default async function TrackerSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [
    { data: session },
    { data: sleepLog },
    { data: drugUseLog },
    { data: linkedIncidents },
    { data: entries },
    { data: sessionEvents },
    { data: sessionMoods },
    { data: sessionNotes },
  ] = await Promise.all([
    supabase.from('drug_tracker_sessions').select('*').eq('id', id).single(),
    supabase.from('sleep_log').select('*').eq('session_id', id).order('logged_at', { ascending: false }),
    supabase.from('drug_use_log').select('*').eq('session_id', id).order('logged_at', { ascending: false }),
    supabase.from('mental_health_incidents')
      .select('id, occurred_at, severity, description, is_sensitive, police_called, ambulance_called, was_arrested, was_sectioned')
      .eq('tracker_session_id', id)
      .order('occurred_at', { ascending: true }),
    supabase.from('tracker_entries').select('*').eq('session_id', id).order('created_at', { ascending: false }),
    supabase.from('session_events').select('*').eq('session_id', id).order('occurred_at', { ascending: true }),
    supabase.from('session_moods').select('*').eq('session_id', id).order('occurred_at', { ascending: true }),
    supabase.from('session_notes').select('*').eq('session_id', id).order('occurred_at', { ascending: true }),
  ])

  if (!session) notFound()

  const canViewSensitive = profile.role !== 'viewer'
  const isAdmin = profile.role === 'admin'

  const sensitiveFieldMask = !canViewSensitive
    ? Object.fromEntries(
        (session.sensitive_fields ?? []).map((f: string) => [f, null])
      )
    : {}

  const safeSession = canViewSensitive ? session : {
    ...session,
    personal_reflection: null,
    ...(session.is_sensitive ? { any_incidents: null, notes: null } : {}),
    ...sensitiveFieldMask,
  }

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <TrackerDetail
          session={safeSession}
          sleepLog={sleepLog ?? []}
          drugUseLog={drugUseLog ?? []}
          linkedIncidents={linkedIncidents ?? []}
          entries={entries ?? []}
          sessionEvents={sessionEvents ?? []}
          sessionMoods={sessionMoods ?? []}
          sessionNotes={sessionNotes ?? []}
          isAdmin={isAdmin}
          canViewSensitive={canViewSensitive}
        />
      </main>
    </AppShell>
  )
}
