import { redirect, notFound } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/layout/Navbar'
import TrackerDetail from './TrackerDetail'

export default async function TrackerSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')
  const supabase = await createClient()
  const [{ data: session }, { data: sleepLog }] = await Promise.all([
    supabase.from('drug_tracker_sessions').select('*').eq('id', id).single(),
    supabase.from('sleep_log').select('*').eq('session_id', id).order('logged_at', { ascending: false }),
  ])
  if (!session) notFound()
  const canViewSensitive = profile.role !== 'viewer'
  const isAdmin = profile.role === 'admin'
  const safeSession = canViewSensitive ? session : { ...session, personal_reflection: null, ...(session.is_sensitive ? { any_incidents: null, notes: null } : {}) }
  return (
    <div className="min-h-screen bg-background">
      <Navbar role={profile.role} displayName={profile.display_name} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <TrackerDetail session={safeSession} sleepLog={sleepLog ?? []} isAdmin={isAdmin} canViewSensitive={canViewSensitive} />
      </main>
    </div>
  )
}
