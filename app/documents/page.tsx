import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/layout/Navbar'
import DocumentsClient from './DocumentsClient'

export default async function DocumentsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  const supabase = await createClient()
  const { data: documents } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
  const canViewSensitive = profile.role !== 'viewer'
  const isAdmin = profile.role === 'admin'
  const filtered = (documents ?? []).filter(doc => {
    if (doc.is_sensitive && !canViewSensitive) return false
    if (doc.allowed_user_ids?.length && !doc.allowed_user_ids.includes(profile.id) && profile.role !== 'admin') return false
    return true
  })
  return (
    <div className="min-h-screen bg-background">
      <Navbar role={profile.role} displayName={profile.display_name} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase mb-8">Documents</h1>
        <DocumentsClient documents={filtered} isAdmin={isAdmin} userId={profile.id} />
      </main>
    </div>
  )
}
