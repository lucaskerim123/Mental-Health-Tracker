import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import InvitesClient from './InvitesClient'

export default async function InvitesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: invites } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase mb-8">Invite Links</h1>
        <InvitesClient invites={invites ?? []} adminId={profile.id} />
      </main>
    </AppShell>
  )
}
