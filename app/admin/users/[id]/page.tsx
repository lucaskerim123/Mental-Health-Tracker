import { redirect, notFound } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import UserDetail from './UserDetail'
import Link from 'next/link'
import { parseRolePermissions } from '@/lib/role-permissions'
import { getAdminOwnerId, isAdminOwner } from '@/lib/admin-owner'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    { data: user },
    { data: permissions },
    { data: authData },
    { data: configRows },
    { data: activityLogs },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).single(),
    supabase.from('permissions').select('*').eq('user_id', id),
    admin.auth.admin.getUserById(id),
    admin.from('site_config').select('key, value').eq('key', 'role_permissions').maybeSingle(),
    admin.from('activity_logs').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(25),
  ])

  if (!user) notFound()
  const rolePermissions = parseRolePermissions(configRows?.value ?? null)
  const ownerId = await getAdminOwnerId()
  const viewerIsOwner = await isAdminOwner(profile.id)
  const targetIsOwner = ownerId === user.id

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-zinc-600 hover:text-zinc-400 text-[11px] font-mono tracking-widest uppercase transition-colors">Admin</Link>
          <span className="text-zinc-700">/</span>
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">User</h1>
        </div>
        <UserDetail
          user={user}
          email={authData?.user?.email ?? ''}
          permissions={permissions ?? []}
          currentUserId={profile.id}
          rolePermissions={rolePermissions}
          activityLogs={activityLogs ?? []}
          viewerIsOwner={viewerIsOwner}
          targetIsOwner={targetIsOwner}
        />
      </main>
    </AppShell>
  )
}

