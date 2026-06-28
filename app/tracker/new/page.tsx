import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import AppShell from '@/components/layout/AppShell'
import NewTrackerForm from './NewTrackerForm'

export default async function NewTrackerPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/tracker')

  return (
    <AppShell role={profile.role} displayName={profile.display_name}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase mb-8">New Session Tracker Entry</h1>
        <NewTrackerForm />
      </main>
    </AppShell>
  )
}
