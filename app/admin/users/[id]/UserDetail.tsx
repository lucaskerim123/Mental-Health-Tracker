'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2, Save, ChevronDown, ChevronRight, Lock, Unlock, AlertTriangle, KeyRound } from 'lucide-react'
import type { UserProfile, Permission, Resource, Action, Role, ActivityLog } from '@/lib/supabase/types'
import { cn, formatDateTime } from '@/lib/utils'
import { ADMIN_SECTION_RESOURCES, MAIN_PAGE_RESOURCES, ROLE_PERMISSION_ACTIONS, ROLE_PERMISSION_RESOURCES, type RolePermissionsMatrix } from '@/lib/role-permissions'

interface Props {
  user: UserProfile
  email: string
  permissions: Permission[]
  currentUserId: string
  rolePermissions: RolePermissionsMatrix
  activityLogs: ActivityLog[]
  viewerIsOwner: boolean
  targetIsOwner: boolean
}

const RESOURCES: Resource[] = ROLE_PERMISSION_RESOURCES

type PermMap = Record<string, Record<string, boolean | null>>

function buildPermMap(permissions: Permission[]): PermMap {
  const map: PermMap = {}
  for (const p of permissions) {
    if (!map[p.resource]) map[p.resource] = {}
    map[p.resource][p.action] = p.granted
  }
  return map
}

function overrideCount(permMap: PermMap, resource: Resource): number {
  return Object.values(permMap[resource] ?? {}).filter(v => v !== null).length
}

function totalOverrides(permMap: PermMap): number {
  return RESOURCES.reduce((sum, r) => sum + overrideCount(permMap, r), 0)
}

export default function UserDetail({ user: initialUser, email, permissions, currentUserId, rolePermissions, activityLogs, viewerIsOwner, targetIsOwner }: Props) {
  const [user, setUser] = useState(initialUser)
  const [displayName, setDisplayName] = useState(initialUser.display_name)
  const [role, setRole] = useState<Role>(initialUser.role)
  const [roleChanged, setRoleChanged] = useState(false)
  const [permMap, setPermMap] = useState<PermMap>(buildPermMap(permissions))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sectionExpanded, setSectionExpanded] = useState({ main: true, admin: true })
  const [toggling, setToggling] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const router = useRouter()
  const isMe = user.id === currentUserId
  const canChangeAdminRole = viewerIsOwner
  const canEditTarget = !targetIsOwner || isMe
  const canEditDisplayName = canEditTarget && !isMe
  const canDeleteTarget = !isMe && (!targetIsOwner || viewerIsOwner)
  const canResetPassword = !targetIsOwner || viewerIsOwner
  const supabase = createClient()

  async function saveProfile() {
    setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, display_name: displayName, role }),
    })
    const data = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) { toast.error(data?.error || 'Save failed'); return }
    setUser(u => ({ ...u, display_name: displayName, role }))
    setRoleChanged(false)
    toast.success('Profile saved.')
  }

  async function deleteUser() {
    if (isMe) { toast.error("Can't delete yourself."); return }
    if (!confirm(`Delete "${user.display_name}"? This removes their account permanently.`)) return
    const res = await fetch('/api/admin/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error || 'Delete failed'); return }
    toast.success('User deleted.')
    router.push('/admin')
  }

  async function resetPassword() {
    if (!newPassword.trim()) { toast.error('Enter a new password.'); return }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return }
    if (!confirm(`Reset password for ${user.display_name}? This replaces the current password immediately.`)) return
    setResettingPassword(true)
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, password: newPassword }),
    })
    const data = await res.json()
    setResettingPassword(false)
    if (!res.ok) { toast.error(data.error || 'Password reset failed'); return }
    setNewPassword('')
    setConfirmPassword('')
    toast.success('Password reset.')
  }

  async function setPermission(resource: Resource, action: Action, next: boolean | null) {
    const key = `${resource}-${action}`
    setToggling(key)
    if (next === null) {
      await supabase.from('permissions').delete().eq('user_id', user.id).eq('resource', resource).eq('action', action)
    } else {
      await supabase.from('permissions').upsert(
        { user_id: user.id, resource, action, granted: next },
        { onConflict: 'user_id,resource,action' }
      )
    }
    setPermMap(prev => {
      const updated = { ...prev, [resource]: { ...(prev[resource] ?? {}) } }
      if (next === null) delete updated[resource][action]
      else updated[resource][action] = next
      return updated
    })
    setToggling(null)
  }

  async function togglePermission(resource: Resource, action: Action) {
    const current = permMap[resource]?.[action] ?? null
    const def = rolePermissions[user.role]?.[resource]?.includes(action) ?? false
    let next: boolean | null
    if (current === null) next = !def
    else if (current === true) next = false
    else next = null
    await setPermission(resource, action, next)
  }

  async function resetResource(resource: Resource) {
    const actions = ROLE_PERMISSION_ACTIONS[resource]
    await Promise.all(actions.map(action =>
      supabase.from('permissions').delete().eq('user_id', user.id).eq('resource', resource).eq('action', action)
    ))
    setPermMap(prev => ({ ...prev, [resource]: {} }))
    toast.success(`${resource} permissions reset to role defaults.`)
  }

  async function setResourceAll(resource: Resource, granted: boolean) {
    const actions = ROLE_PERMISSION_ACTIONS[resource]
    await Promise.all(actions.map(action =>
      supabase.from('permissions').upsert(
        { user_id: user.id, resource, action, granted },
        { onConflict: 'user_id,resource,action' }
      )
    ))
    setPermMap(prev => ({ ...prev, [resource]: Object.fromEntries(actions.map(a => [a, granted])) }))
    toast.success(`All ${resource} permissions ${granted ? 'granted' : 'denied'}.`)
  }

  const profileChanged = displayName !== user.display_name || role !== user.role
const total = totalOverrides(permMap)
  const recentIps = Array.from(new Set(activityLogs.map(log => log.ip_address).filter((value): value is string => !!value))).slice(0, 5)
  const recentAgents = Array.from(new Set(activityLogs.map(log => typeof log.metadata?.user_agent === 'string' ? log.metadata.user_agent : null).filter((value): value is string => !!value))).slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-5">Profile</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Display Name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={!canEditDisplayName} className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-40" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Email</label>
            <input type="text" value={email} readOnly className="w-full bg-black border border-zinc-800/50 text-zinc-500 px-3 py-2 text-sm font-mono cursor-default" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Role</label>
            <select value={role} onChange={e => { setRole(e.target.value as Role); setRoleChanged(true) }} disabled={isMe || (user.role === 'admin' && !canChangeAdminRole) || (role === 'admin' && !canChangeAdminRole) || targetIsOwner} className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none disabled:opacity-40">
              <option value="viewer">viewer</option>
              <option value="lawyer">lawyer</option>
              <option value="counsellor">counsellor</option>
              <option value="admin">admin</option>
              {viewerIsOwner && <option value="owner">owner</option>}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Joined</label>
            <input type="text" value={new Date(user.created_at).toLocaleDateString()} readOnly className="w-full bg-black border border-zinc-800/50 text-zinc-500 px-3 py-2 text-sm font-mono cursor-default" />
          </div>
        </div>
        {targetIsOwner && (
          <div className="flex items-start gap-2 border border-red-900/40 bg-red-950/10 px-3 py-2 mb-4">
            <AlertTriangle className="w-3 h-3 text-red-700 mt-0.5 shrink-0" />
            <p className="text-[10px] font-mono text-red-700/80">This is the owner account. Other users cannot change or remove it.</p>
          </div>
        )}
        {roleChanged && (
          <div className="flex items-start gap-2 border border-amber-900/40 bg-amber-950/10 px-3 py-2 mb-4">
            <AlertTriangle className="w-3 h-3 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-[10px] font-mono text-amber-700/80">Override permissions are preserved when role changes — reset individual resources manually if needed.</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button onClick={saveProfile} disabled={!profileChanged || saving || isMe || !canEditTarget} className="flex items-center gap-2 px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-zinc-500 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-30">
            <Save className="w-3 h-3" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {canDeleteTarget && (
            <button onClick={deleteUser} className="flex items-center gap-2 px-4 py-2 border border-red-900/40 text-red-800 hover:border-red-700 hover:text-red-600 text-[11px] font-mono tracking-widest uppercase transition-colors">
              <Trash2 className="w-3 h-3" /> Delete Account
            </button>
          )}
        </div>
      </div>

      <div className="border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4">Password Reset</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-600 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-600 transition-colors" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button onClick={resetPassword} disabled={!canResetPassword || resettingPassword || !newPassword || !confirmPassword} className="flex items-center gap-2 px-4 py-2 border border-amber-900/50 text-amber-700 hover:border-amber-700 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-30">
            <KeyRound className="w-3 h-3" />
            {resettingPassword ? 'Resetting...' : 'Reset Password'}
          </button>
          <p className="text-[10px] font-mono text-zinc-700">Admins can replace the current password for this account.</p>
        </div>
      </div>

      <div className="border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <div>
          <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Identifiers</p>
          <p className="mt-1 text-[10px] font-mono text-zinc-700">Recent request fingerprints pulled from activity logs for this account.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Recent IPs</p>
            {recentIps.length ? recentIps.map(ip => <p key={ip} className="text-xs font-mono text-zinc-300 break-all">{ip}</p>) : <p className="text-[10px] font-mono text-zinc-700">No IPs logged yet.</p>}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">User Agents</p>
            {recentAgents.length ? recentAgents.map(agent => <p key={agent} className="text-[10px] font-mono text-zinc-300 break-words [overflow-wrap:anywhere]">{agent}</p>) : <p className="text-[10px] font-mono text-zinc-700">No user agents logged yet.</p>}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Recent Activity</p>
          {activityLogs.length ? activityLogs.slice(0, 10).map(log => (
            <div key={log.id} className="border border-zinc-800 bg-black/30 px-3 py-2">
              <p className="text-[10px] font-mono text-zinc-400">{log.action} · {formatDateTime(log.created_at)}</p>
              {log.ip_address && <p className="text-[10px] font-mono text-zinc-600">IP: {log.ip_address}</p>}
            </div>
          )) : <p className="text-[10px] font-mono text-zinc-700">No activity logged yet.</p>}
        </div>
      </div>

      <div className="border border-zinc-800 bg-zinc-950">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Permissions</p>
          {total > 0 && <span className="text-[9px] font-mono text-zinc-600 tracking-widest">{total} override{total !== 1 ? 's' : ''} active</span>}
        </div>
        <div className="space-y-3 p-3">
          {permissionGroups.map(group => (
            <div key={group.key} className="border border-zinc-800/60">
              <button type="button" onClick={() => setSectionExpanded(prev => ({ ...prev, [group.key]: !prev[group.key] }))} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">{group.label}</span>
                <span className="text-[10px] font-mono text-zinc-600">{sectionExpanded[group.key] ? 'Hide' : 'Show'}</span>
              </button>
              {sectionExpanded[group.key] && (
                <div className="border-t border-zinc-800/40">
                  {group.resources.map(resource => {
                    const actions = ROLE_PERMISSION_ACTIONS[resource]
                    const count = overrideCount(permMap, resource)
                    const isOpen = expanded[resource] ?? false
                    return (
                      <div key={resource}>
                        <div className="flex items-center gap-3 px-5 py-3">
                          <button type="button" onClick={() => setExpanded(prev => ({ ...prev, [resource]: !isOpen }))} className="flex items-center gap-2 flex-1 text-left">
                            {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">{resource.replace(/_/g, ' ')}</span>
                            {count > 0 && <span className="text-[9px] font-mono bg-zinc-800 text-zinc-500 px-1.5 py-0.5 tracking-wider">{count} override{count !== 1 ? 's' : ''}</span>}
                          </button>
                          {!isMe && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => resetResource(resource)} className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 tracking-widest uppercase px-2 py-1 border border-zinc-800 hover:border-zinc-600 transition-colors">Reset</button>
                              <button type="button" onClick={() => setResourceAll(resource, true)} className="text-[9px] font-mono text-green-900 hover:text-green-700 tracking-widest uppercase px-2 py-1 border border-green-900/30 hover:border-green-800 transition-colors">Grant All</button>
                              <button type="button" onClick={() => setResourceAll(resource, false)} className="text-[9px] font-mono text-red-900 hover:text-red-700 tracking-widest uppercase px-2 py-1 border border-red-900/30 hover:border-red-800 transition-colors">Deny All</button>
                            </div>
                          )}
                        </div>
                        {isOpen && (
                          <div className="border-t border-zinc-800/40">
                            {actions.map(action => {
                              const override = permMap[resource]?.[action] ?? null
                              const def = rolePermissions[user.role]?.[resource]?.includes(action) ?? false
                              const effective = override !== null ? override : def
                              const isOverride = override !== null
                              const key = `${resource}-${action}`
                              const busy = toggling === key
                              return (
                                <div key={action} className="flex items-center justify-between px-8 py-2.5 hover:bg-zinc-900/30 transition-colors">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono text-zinc-500 tracking-wide">{action.replace(/_/g, ' ')}</span>
                                    {isOverride && <span className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 bg-zinc-800/60 text-zinc-600">override</span>}
                                  </div>
                                  {isMe ? (
                                    <span className="text-[10px] font-mono text-green-800">{effective ? 'granted' : 'denied'}</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => !busy && togglePermission(resource, action)}
                                      disabled={busy}
                                      title={`Role default: ${def ? 'granted' : 'denied'}. Click to cycle.`}
                                      className={cn(
                                        'flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono tracking-widest uppercase border transition-colors disabled:opacity-50',
                                        override === null
                                          ? effective ? 'border-zinc-700 text-zinc-500 bg-zinc-800/30' : 'border-zinc-800 text-zinc-700'
                                          : override === true ? 'border-green-800 text-green-700 bg-green-950/30'
                                          : 'border-red-900 text-red-800 bg-red-950/20'
                                      )}
                                    >
                                      {override === null ? (
                                        <>{effective ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />} {effective ? 'default on' : 'default off'}</>
                                      ) : override === true ? (
                                        <><Unlock className="w-2.5 h-2.5" /> granted</>
                                      ) : (
                                        <><Lock className="w-2.5 h-2.5" /> denied</>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-zinc-800/60">
          <p className="text-[9px] font-mono text-zinc-700">Bright green = explicit grant · Red = explicit deny · Muted = role default · Click to cycle states</p>
        </div>
      </div>
    </div>
  )
}
  const permissionGroups = [
    { key: 'main' as const, label: 'Main Pages', resources: MAIN_PAGE_RESOURCES },
    { key: 'admin' as const, label: 'Admin Sections', resources: ADMIN_SECTION_RESOURCES },
  ]
