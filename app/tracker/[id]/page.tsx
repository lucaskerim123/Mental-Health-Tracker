import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import TrackerDetail from './TrackerDetail'

type SessionEventRow = {
  id: string
  session_id: string
  event_type?: string | null
  title?: string | null
  content?: string | null
  entry_type?: string | null
  occurred_at: string
}

function eventLabel(event: SessionEventRow) {
  const original = event.event_type || event.entry_type || event.title || event.content || ''
  const raw = original.trim().toLowerCase()
  if (raw === 'start' || raw === 'session_start' || raw === 'sesh_start' || raw === 'start_session') return 'Sesh started'
  if (raw === 'stop' || raw === 'session_stop' || raw === 'sesh_stop' || raw === 'end' || raw === 'end_session' || raw === 'close_session') return 'Sesh stopped'
  if (raw.includes('mood')) return 'Mood entry'
  if (raw.includes('sleep')) return 'Sleep'
  if (raw.includes('note')) return 'Note'
  if (raw.includes('usage')) return 'Usage log'
  if (raw.includes('incident')) return 'Incident link'
  if (raw.includes('document') || raw.includes('attachment')) return 'Document link'
  if (raw.includes('edit') || raw.includes('update')) return 'Edited entry'
  if (raw.includes('link')) return 'Linked record'
  if (raw.includes('summary') || raw.includes('summarise') || raw.includes('summarize')) return 'Summary command'
  if (raw.includes('status') || raw.includes('check')) return 'Status check'
  return original || 'Session event'
}

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
    { data: availableIncidents },
    { data: entries },
    { data: sessionEvents },
    { data: sessionMoods },
    { data: sessionNotes },
  ] = await Promise.all([
    supabase.from('drug_tracker_sessions').select('*').eq('id', id).single(),
    supabase.from('sleep_log').select('*').eq('session_id', id).order('logged_at', { ascending: false }),
    supabase.from('drug_use_log').select('*').eq('session_id', id).order('logged_at', { ascending: false }),
    supabase.from('mental_health_incidents')
      .select('id, incident_number, occurred_at, severity, description, is_sensitive, sensitive_fields, field_visibility, police_called, ambulance_called, was_arrested, was_sectioned')
      .eq('tracker_session_id', id)
      .order('occurred_at', { ascending: true }),
    supabase.from('mental_health_incidents')
      .select('id, incident_number, occurred_at, severity, description, is_sensitive, sensitive_fields, field_visibility, police_called, ambulance_called, was_arrested, was_sectioned')
      .is('tracker_session_id', null)
      .order('occurred_at', { ascending: false })
      .limit(50),
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
    ...(session.is_sensitive ? { notes: null } : {}),
    ...sensitiveFieldMask,
  }

  const simpleSessionEvents = ((sessionEvents ?? []) as SessionEventRow[]).map(event => ({
    ...event,
    event_type: eventLabel(event),
    title: null,
  }))

  return (
    <AppShell userId={profile.id} role={profile.role} displayName={profile.display_name}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="md:hidden mb-4">
          <Link href="/tracker" className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 transition-colors">
            Back to tracker
          </Link>
        </div>
        <TrackerDetail
          session={safeSession}
          sleepLog={sleepLog ?? []}
          drugUseLog={drugUseLog ?? []}
          linkedIncidents={linkedIncidents ?? []}
          availableIncidents={availableIncidents ?? []}
          entries={entries ?? []}
          sessionEvents={simpleSessionEvents}
          sessionMoods={sessionMoods ?? []}
          sessionNotes={sessionNotes ?? []}
          role={profile.role}
          isAdmin={isAdmin}
          canViewSensitive={canViewSensitive}
        />
      </main>
    </AppShell>
  )
}

