import Sidebar from './Sidebar'
import CaptureGuard from '@/components/security/CaptureGuard'
import FancyRedactedHydrator from '@/components/permissions/FancyRedactedHydrator'
import { createAdminClient } from '@/lib/supabase/admin'

interface AppShellProps {
  role: string
  displayName: string
  children: React.ReactNode
}

export default async function AppShell({ role, displayName, children }: AppShellProps) {
  let lockdownActive = false
  let hasPin = false

  if (role === 'admin') {
    const admin = createAdminClient()
    const { data } = await admin.from('site_config').select('key, value').in('key', ['lockdown_mode', 'lockdown_pin_hash'])
    const config = Object.fromEntries((data ?? []).map(row => [row.key, row.value ?? '']))
    lockdownActive = config.lockdown_mode === 'true'
    hasPin = !!config.lockdown_pin_hash
  }

  return (
    <div className="flex min-h-screen bg-background">
      <CaptureGuard enabled={role !== 'admin'} />
      <FancyRedactedHydrator />
      <Sidebar role={role} displayName={displayName} lockdownActive={lockdownActive} hasPin={hasPin} />
      {/* Offset for desktop sidebar; offset top for mobile header */}
      <div className="flex-1 min-w-0 md:ml-[220px] pt-12 md:pt-0">
        {children}
      </div>
    </div>
  )
}
