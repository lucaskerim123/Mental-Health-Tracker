import type { Resource } from './supabase/types'

export const ADMIN_SECTIONS: Array<{ id: Resource; href: string; label: string }> = [
  { id: 'admin_users', href: '/admin', label: 'Users' },
  { id: 'admin_roles', href: '/admin?tab=roles', label: 'Roles' },
  { id: 'admin_bans', href: '/admin?tab=bans', label: 'Bans' },
  { id: 'admin_activity', href: '/admin?tab=activity', label: 'Activity' },
  { id: 'admin_config', href: '/admin?tab=config', label: 'Config' },
  { id: 'admin_lockdown', href: '/admin?tab=lockdown', label: 'Lockdown' },
  { id: 'admin_invites', href: '/admin/invites', label: 'Invites' },
]
