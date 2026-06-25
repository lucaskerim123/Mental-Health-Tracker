'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import type { UserProfile, Permission, Resource, Action, Role } from '@/lib/supabase/types'
import { ROLE_DEFAULTS } from '@/lib/supabase/types'

interface Props { users: UserProfile[]; permissions: Permission[]; currentUserId: string }
type PermMap = Record<string, Record<string, Record<string, boolean | null>>>

const RESOURCES: Resource[] = ['incidents', 'tracker', 'documents', 'users', 'admin']
const ACTIONS: Action[] = ['view', 'view_sensitive', 'create', 'edit', 'delete', 'manage_users', 'manage_invites']

function buildPermMap(permissions: Permission[]): PermMap {
  const map: PermMap = {}
  for (const p of permissions) {
    if (!map[p.user_id]) map[p.user_id] = {}
    if (!map[p.user_id][p.resource]) map[p.user_id][p.resource] = {}
    map[p.user_id][p.resource][p.action] = p.granted
  }
  return map
}

function roleDefault(role: Role, resource: Resource, action: Action): boolean {
  return ROLE_DEFAULTS[role]?.[resource]?.includes(action) ?? false
}

export default function AdminClient({ users: initialUsers, permissions, currentUserId }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [permMap, setPermMap] = useState<PermMap>(buildPermMap(permissions))
  const [toggling, setToggling] = useState<string | null>(null)

  async function togglePermission(user: UserProfile, resource: Resource, action: Action) {
    const key = `${user.id}-${resource}-${action}`
    setToggling(key)
    const current = permMap[user.id]?.[resource]?.[action] ?? null
    const def = roleDefault(user.role, resource, action)
    let next: boolean | null
    if (current === null) next = !def
    else if (current === true) next = false
    else next = null
    const supabase = createClient()
    if (next === null) {
      await supabase.from('permissions').delete().eq('user_id', user.id).eq('resource', resource).eq('action', action)
    } else {
      await supabase.from('permissions').upsert({ user_id: user.id, resource, action, granted: next }, { onConflict: 'user_id,resource,action' })
    }
    setPermMap(prev => {
      const updated = { ...prev }
      if (!updated[user.id]) updated[user.id] = {}
      if (!updated[user.id][resource]) updated[user.id][resource] = {}
      if (next === null) delete updated[user.id][resource][action]
      else updated[user.id][resource][action] = next
      return updated
    })
    setToggling(null)
  }

  async function changeRole(user: UserProfile, newRole: Role) {
    const supabase = createClient()
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', user.id)
    if (error) { toast.error('Failed.'); return }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
    toast.success(`Role updated to ${newRole}.`)
  }

  async function deleteUser(user: UserProfile) {
    if (user.id === currentUserId) { toast.error("Can't delete yourself."); return }
    if (!confirm(`Delete user "${user.display_name}"? This cannot be undone.`)) return
    const supabase = createClient()
    await supabase.from('users').delete().eq('id', user.id)
    setUsers(prev => prev.filter(u => u.id !== user.id))
    toast.success('User deleted.')
  }

  return (
    <div className="space-y-8">
      {users.map(user => {
        const isMe = user.id === currentUserId
        return (
          <div key={user.id} className="border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-mono text-zinc-300">{user.display_name} {isMe && <span className="text-[9px] text-zinc-600">(you)</span>}</p>
                <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{user.id.slice(0, 8)}…</p>
              </div>
              <div className="flex items-center gap-3">
                {!isMe && (
                  <select value={user.role} onChange={e => changeRole(user, e.target.value as Role)} className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] font-mono px-2 py-1 focus:outline-none" disabled={user.role === 'admin'}>
                    <option value="viewer">viewer</option>
                    <option value="counsellor">counsellor</option>
                    <option value="admin">admin</option>
                  </select>
                )}
                {!isMe && <button onClick={() => deleteUser(user)} className="p-1.5 text-red-900 hover:text-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr>
                    <th className="text-left text-zinc-600 pb-2 pr-4 tracking-widest uppercase w-24">Resource</th>
                    {ACTIONS.map(a => <th key={a} className="text-center text-zinc-600 pb-2 px-1 tracking-widest uppercase whitespace-nowrap">{a.replace('_', ' ')}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map(resource => (
                    <tr key={resource} className="border-t border-zinc-800/50">
                      <td className="py-2 pr-4 text-zinc-500 tracking-widest uppercase">{resource}</td>
                      {ACTIONS.map(action => {
                        const override = permMap[user.id]?.[resource]?.[action] ?? null
                        const def = roleDefault(user.role, resource, action)
                        const effective = override !== null ? override : def
                        const isOverride = override !== null
                        const key = `${user.id}-${resource}-${action}`
                        return (
                          <td key={action} className="py-2 px-1 text-center">
                            {isMe ? <span className="text-green-800">✓</span> : (
                              <button onClick={() => togglePermission(user, resource, action)} disabled={toggling === key}
                                title={isOverride ? `Override: ${effective ? 'granted' : 'denied'}` : `Role default: ${effective ? 'granted' : 'denied'}`}
                                className={`w-6 h-6 border transition-colors ${effective ? (isOverride ? 'border-green-800 bg-green-950/50 text-green-700' : 'border-zinc-700 bg-zinc-800/50 text-zinc-500') : (isOverride ? 'border-red-900 bg-red-950/30 text-red-800' : 'border-zinc-800 text-zinc-700')}`}>
                                {effective ? '✓' : '−'}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] font-mono text-zinc-700 mt-3">Bright green = explicit grant override · Red = explicit deny override · Muted = role default</p>
          </div>
        )
      })}
    </div>
  )
}
