import Sidebar from './Sidebar'
import CaptureGuard from '@/components/security/CaptureGuard'
import FancyRedactedHydrator from '@/components/permissions/FancyRedactedHydrator'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPermissionContext, can } from '@/lib/auth'
import type { Resource } from '@/lib/supabase/types'
import { ADMIN_SECTIONS } from '@/lib/navigation'

interface AppShellProps {
  userId: string
  role: string
  displayName: string
  children: React.ReactNode
}

export default async function AppShell({ userId, role, displayName, children }: AppShellProps) {
  let lockdownActive = false
  let hasPin = false
  let canViewAdmin = false
  let allowedAdminSections: Resource[] = []

  if (role === 'admin' || role === 'owner') {
    const admin = createAdminClient()
    const { data } = await admin.from('site_config').select('key, value').in('key', ['lockdown_mode', 'lockdown_pin_hash'])
    const config = Object.fromEntries((data ?? []).map(row => [row.key, row.value ?? '']))
    lockdownActive = config.lockdown_mode === 'true'
    hasPin = !!config.lockdown_pin_hash
  }

  const { overrides, roleDefaults } = await getPermissionContext(userId)
  const profile = { id: userId, role: role as AppShellProps['role'], display_name: displayName, created_at: '' }
  canViewAdmin = can(profile as never, overrides, 'admin', 'view', roleDefaults)
  allowedAdminSections = ADMIN_SECTIONS
    .filter(section => can(profile as never, overrides, section.id, 'view', roleDefaults))
    .map(section => section.id)

  return (
    <div className="flex min-h-screen bg-background">
      <CaptureGuard enabled={role !== 'admin' && role !== 'owner'} />
      <FancyRedactedHydrator />
      <Sidebar role={role} displayName={displayName} lockdownActive={lockdownActive} hasPin={hasPin} canViewAdmin={canViewAdmin} allowedAdminSections={allowedAdminSections} />
      {/* Offset for desktop sidebar; offset top for mobile header */}
      <div className="flex-1 min-w-0 md:ml-[220px] pt-12 md:pt-0">
        {children}
      </div>
    </div>
  )
}
