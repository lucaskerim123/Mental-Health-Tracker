import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import AdminClient from './AdminClient'
import Link from 'next/link'

export default async function AdminPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    { data: users },
    { data: allPermissions },
    { data: bans },
    { data: activityLogs },
    { data: configRows },
  ] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: true }),
    supabase.from('permissions').select('user_id'),
    admin.from('bans').select('*').order('created_at', { ascending: false }),
    admin.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100),
    admin.from('site_config').select('key, value, updated_at'),
  ])

  const overrideCounts: Record<string, number> = {}
  for (const p of allPermissions ?? []) {
    overrideCounts[p.user_id] = (overrideCounts[p.user_id] ?? 0) + 1
  }

  const config = Object.fromEntries((configRows ?? []).map(r => [r.key, r.value ?? '']))

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">Admin</h1>
          <Link href="/admin/invites" className="border border-zinc-700 text-zinc-400 hover:border-zinc-500 px-4 py-2 text-[11px] font-mono tracking-widest uppercase transition-colors">
            Manage Invites
          </Link>
        </div>
        <AdminClient
          users={users ?? []}
          currentUserId={profile.id}
          overrideCounts={overrideCounts}
          bans={bans ?? []}
          activityLogs={activityLogs ?? []}
          config={config}
        />
      </main>
    </AppShell>
  )
}
