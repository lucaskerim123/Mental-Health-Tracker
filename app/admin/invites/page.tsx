import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import InvitesClient from './InvitesClient'
import { isAdminOwner } from '@/lib/admin-owner'
import { can, getPermissionContext } from '@/lib/auth'

export default async function InvitesPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  const { overrides, roleDefaults } = await getPermissionContext(profile.id)
  if (!can(profile, overrides, 'admin', 'view', roleDefaults) || !can(profile, overrides, 'admin_invites', 'view', roleDefaults)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: invites } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false })
  const canInviteAdmin = await isAdminOwner(profile.id)

  return (
    <AppShell userId={profile.id} role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase mb-8">Invite Links</h1>
        <InvitesClient invites={invites ?? []} canInviteAdmin={canInviteAdmin} />
      </main>
    </AppShell>
  )
}
