import { redirect, notFound } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/layout/Navbar'
import IncidentDetail from './IncidentDetail'

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: incident } = await supabase
    .from('mental_health_incidents')
    .select('*')
    .eq('id', id)
    .single()

  if (!incident) notFound()

  const canViewSensitive = profile.role !== 'viewer'
  const isAdmin = profile.role === 'admin'

  const sensitiveFieldMask = !canViewSensitive
    ? Object.fromEntries(
        (incident.sensitive_fields ?? []).map((f: string) => [f, f === 'description' ? '[Restricted]' : null])
      )
    : {}

  const safeIncident = canViewSensitive ? incident : {
    ...incident,
    personal_notes: null,
    ...(incident.is_sensitive ? { description: '[Restricted]', notes: null } : {}),
    ...sensitiveFieldMask,
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar role={profile.role} displayName={profile.display_name} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <IncidentDetail incident={safeIncident} isAdmin={isAdmin} canViewSensitive={canViewSensitive} />
      </main>
    </div>
  )
}
