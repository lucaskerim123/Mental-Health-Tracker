import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SetupForm from './SetupForm'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const admin = createAdminClient()
  const { count } = await admin.from('users').select('*', { count: 'exact', head: true })
  if (count && count > 0) redirect('/login')
  return <SetupForm />
}
