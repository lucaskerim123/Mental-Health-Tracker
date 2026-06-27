import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'

export default async function Home() {
  const headerStore = await headers()
  const userAgent = headerStore.get('user-agent') ?? ''
  const isPhoneApp = userAgent.includes('MentalHealthTrackerApp')
  const profile = await getProfile()

  if (isPhoneApp) {
    if (profile) redirect('/mobile')
    redirect('/mobile/login?next=/mobile')
  }

  if (profile) redirect('/dashboard')
  redirect('/login')
}
