'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2, Save, ChevronDown, ChevronRight, Lock, Unlock, AlertTriangle } from 'lucide-react'
import type { UserProfile, Permission, Resource, Action, Role } from '@/lib/supabase/types'
import { ROLE_DEFAULTS } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

interface Props {
  user: UserProfile
  email: string
  permissions: Permission[]
  currentUserId: string
}

const RESOURCES: Resource[] = ['incidents', 'tracker', 'documents', 'users', 'admin']
const RESOURCE_ACTIONS: Record<Resource, Action[]> = {
  incidents:  ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  tracker:    ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  documents:  ['view', 'view_sensitive', 'create', 'edit', 'delete'],
  users:      ['manage_users', 'manage_invites'],
  admin:      ['view'],
}

type PermMap = Record<string, Record<string, boolean | null>>

function buildPermMap(permissions: Permission[]): PermMap {
  const map: PermMap = {}
  for (const p of permissions) {
    if (!map[p.resource]) map[p.resource] = {}
    map[p.resource][p.action] = p.granted
  }
  return map
}

function roleDefault(role: Role, resource: Resource, action: Action): boolean {
  return ROLE_DEFAULTS[role]?.[resource]?.includes(action) ?? false
}

function overrideCount(permMap: PermMap, resource: Resource): number {
  return Object.values(permMap[resource] ?? {}).filter(v => v !== null).length
}

function totalOverrides(permMap: PermMap): number {
  return RESOURCES.reduce((sum, r) => sum + overrideCount(permMap, r), 0)
}

export default function UserDetail({ user: initialUser, email, permissions, currentUserId }: Props) {
  const [user, setUser] = useState(initialUser)
  const [displayName, setDisplayName] = useState(initialUser.display_name)
  const [role, setRole] = useState<Role>(initialUser.role)
  const [roleChanged, setRoleChanged] = useState(false)
  const [permMap, setPermMap] = useState<PermMap>(buildPermMap(permissions))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [toggling, setToggling] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const isMe = user.id === currentUserId
  const supabase = createClient()

  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase.from('users').update({ display_name: displayName, role }).eq('id', user.id)
    setSaving(false)
    if (error) { toast.error('Save failed: ' + error.message); return }
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

  async function setPermission(resource: Resource, action: Action, next: boolean | null) {
    const key = `${resource}-${action}`
    setToggling(key)
    if (next === null) {
      await supabase.from('permissions').delete()
        .eq('user_id', user.id).eq('resource', resource).eq('action', action)
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
    const def = roleDefault(user.role, resource, action)
    let next: boolean | null
    if (current === null) next = !def
    else if (current === true) next = false
    else next = null
    await setPermission(resource, action, next)
  }

  async function resetResource(resource: Resource) {
    const actions = RESOURCE_ACTIONS[resource]
    await Promise.all(actions.map(action =>
      supabase.from('permissions').delete()
        .eq('user_id', user.id).eq('resource', resource).eq('action', action)
    ))
    setPermMap(prev => ({ ...prev, [resource]: {} }))
    toast.success(`${resource} permissions reset to role defaults.`)
  }

  async function setResourceAll(resource: Resource, granted: boolean) {
    const actions = RESOURCE_ACTIONS[resource]
    await Promise.all(actions.map(action =>
      supabase.from('permissions').upsert(
        { user_id: user.id, resource, action, granted },
        { onConflict: 'user_id,resource,action' }
      )
    ))
    setPermMap(prev => ({
      ...prev,
      [resource]: Object.fromEntries(actions.map(a => [a, granted])),
    }))
    toast.success(`All ${resource} permissions ${granted ? 'granted' : 'denied'}.`)
  }

  const profileChanged = displayName !== user.display_name || role !== user.role
  const total = totalOverrides(permMap)

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-5">Profile</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              disabled={isMe}
              className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Email</label>
            <input type="text" value={email} readOnly className="w-full bg-black border border-zinc-800/50 text-zinc-500 px-3 py-2 text-sm font-mono cursor-default" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Role</label>
            <select
              value={role}
              onChange={e => { setRole(e.target.value as Role); setRoleChanged(true) }}
              disabled={isMe}
              className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none disabled:opacity-40"
            >
              <option value="viewer">viewer</option>
              <option value="counsellor">counsellor</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Joined</label>
            <input type="text" value={new Date(user.created_at).toLocaleDateString()} readOnly className="w-full bg-black border border-zinc-800/50 text-zinc-500 px-3 py-2 text-sm font-mono cursor-default" />
          </div>
        </div>

        {roleChanged && (
          <div className="flex items-start gap-2 border border-amber-900/40 bg-amber-950/10 px-3 py-2 mb-4">
            <AlertTriangle className="w-3 h-3 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-[10px] font-mono text-amber-700/80">
              Override permissions are preserved when role changes — reset individual resources manually if needed.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={saveProfile}
            disabled={!profileChanged || saving || isMe}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-zinc-500 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-30"
          >
            <Save className="w-3 h-3" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {!isMe && (
            <button
              onClick={deleteUser}
              className="flex items-center gap-2 px-4 py-2 border border-red-900/40 text-red-800 hover:border-red-700 hover:text-red-600 text-[11px] font-mono tracking-widest uppercase transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete Account
            </button>
          )}
        </div>
      </div>

      {/* Permission Accordion */}
      <div className="border border-zinc-800 bg-zinc-950">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Permissions</p>
          {total > 0 && (
            <span className="text-[9px] font-mono text-zinc-600 tracking-widest">{total} override{total !== 1 ? 's' : ''} active</span>
          )}
        </div>

        <div className="divide-y divide-zinc-800/60">
          {RESOURCES.map(resource => {
            const actions = RESOURCE_ACTIONS[resource]
            const count = overrideCount(permMap, resource)
            const isOpen = expanded[resource] ?? false

            return (
              <div key={resource}>
                {/* Resource header */}
                <div className="flex items-center gap-3 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(prev => ({ ...prev, [resource]: !isOpen }))}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isOpen
                      ? <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                    }
                    <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">{resource}</span>
                    {count > 0 && (
                      <span className="text-[9px] font-mono bg-zinc-800 text-zinc-500 px-1.5 py-0.5 tracking-wider">
                        {count} override{count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                  {!isMe && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => resetResource(resource)}
                        className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 tracking-widest uppercase px-2 py-1 border border-zinc-800 hover:border-zinc-600 transition-colors"
                        title="Reset to role defaults"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setResourceAll(resource, true)}
                        className="text-[9px] font-mono text-green-900 hover:text-green-700 tracking-widest uppercase px-2 py-1 border border-green-900/30 hover:border-green-800 transition-colors"
                        title="Explicitly grant all"
                      >
                        Grant All
                      </button>
                      <button
                        type="button"
                        onClick={() => setResourceAll(resource, false)}
                        className="text-[9px] font-mono text-red-900 hover:text-red-700 tracking-widest uppercase px-2 py-1 border border-red-900/30 hover:border-red-800 transition-colors"
                        title="Explicitly deny all"
                      >
                        Deny All
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded action rows */}
                {isOpen && (
                  <div className="border-t border-zinc-800/40">
                    {actions.map(action => {
                      const override = permMap[resource]?.[action] ?? null
                      const def = roleDefault(user.role, resource, action)
                      const effective = override !== null ? override : def
                      const isOverride = override !== null
                      const key = `${resource}-${action}`
                      const busy = toggling === key

                      return (
                        <div key={action} className="flex items-center justify-between px-8 py-2.5 hover:bg-zinc-900/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-zinc-500 tracking-wide">
                              {action.replace(/_/g, ' ')}
                            </span>
                            {isOverride && (
                              <span className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 bg-zinc-800/60 text-zinc-600">
                                override
                              </span>
                            )}
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
                                  ? effective
                                    ? 'border-zinc-700 text-zinc-500 bg-zinc-800/30'
                                    : 'border-zinc-800 text-zinc-700'
                                  : override === true
                                  ? 'border-green-800 text-green-700 bg-green-950/30'
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

        <div className="px-5 py-3 border-t border-zinc-800/60">
          <p className="text-[9px] font-mono text-zinc-700">
            Bright green = explicit grant · Red = explicit deny · Muted = role default · Click to cycle states
          </p>
        </div>
      </div>
    </div>
  )
}
