import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import AdminClient from './AdminClient'
import Link from 'next/link'

export default async function AdminPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: users }, { data: allPermissions }] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: true }),
    supabase.from('permissions').select('user_id'),
  ])

  const overrideCounts: Record<string, number> = {}
  for (const p of allPermissions ?? []) {
    overrideCounts[p.user_id] = (overrideCounts[p.user_id] ?? 0) + 1
  }

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">Admin</h1>
          <Link href="/admin/invites" className="border border-zinc-700 text-zinc-400 hover:border-zinc-500 px-4 py-2 text-[11px] font-mono tracking-widest uppercase transition-colors">
            Manage Invites
          </Link>
        </div>
        <AdminClient users={users ?? []} currentUserId={profile.id} overrideCounts={overrideCounts} />
      </main>
    </AppShell>
  )
}
