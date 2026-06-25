import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import NewIncidentForm from './NewIncidentForm'
import Navbar from '@/components/layout/Navbar'

export default async function NewIncidentPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/incidents')
  return (
    <div className="min-h-screen bg-background">
      <Navbar role={profile.role} displayName={profile.display_name} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase mb-8">New Incident</h1>
        <NewIncidentForm />
      </main>
    </div>
  )
}
