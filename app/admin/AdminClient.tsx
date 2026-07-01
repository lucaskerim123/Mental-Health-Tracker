'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, ChevronRight, UserPlus, Search, Shield, Activity, Settings, AlertTriangle, Ban, X } from 'lucide-react'
import Link from 'next/link'
import type { UserProfile, Role, Ban as BanType, ActivityLog } from '@/lib/supabase/types'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { RolePermissionsMatrix } from '@/lib/role-permissions'
import RolesTab from './RolesTab'

type Tab = 'users' | 'roles' | 'bans' | 'activity' | 'config' | 'lockdown'
type TabOption = { id: Tab; label: string }

interface Props {
  users: UserProfile[]
  currentUserId: string
  overrideCounts: Record<string, number>
  bans: BanType[]
  activityLogs: ActivityLog[]
  config: Record<string, string>
  rolePermissions: RolePermissionsMatrix
  allowedTabs: Tab[]
  canManageUsers: boolean
  canAssignPrivilegedRoles: boolean
}

const ROLE_COLORS: Record<Role, string> = {
  owner: 'text-red-500',
  admin: 'text-red-700',
  lawyer: 'text-blue-700',
  counsellor: 'text-amber-700',
  viewer: 'text-zinc-500',
}

const TAB_ICONS: Record<Tab, ReactNode> = {
  users: <UserPlus className="w-3 h-3" />,
  roles: <Shield className="w-3 h-3" />,
  bans: <Ban className="w-3 h-3" />,
  activity: <Activity className="w-3 h-3" />,
  config: <Settings className="w-3 h-3" />,
  lockdown: <Shield className="w-3 h-3" />,
}

function UsersTab({ users: initialUsers, currentUserId, overrideCounts, canManageUsers, canAssignPrivilegedRoles }: {
  users: UserProfile[]
  currentUserId: string
  overrideCounts: Record<string, number>
  canManageUsers: boolean
  canAssignPrivilegedRoles: boolean
}) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [creating, setCreating] = useState(false)

  const ownerCount = users.filter(u => u.role === 'owner').length
  const adminCount = users.filter(u => u.role === 'admin').length
  const lawyerCount = users.filter(u => u.role === 'lawyer').length
  const counsellorCount = users.filter(u => u.role === 'counsellor').length
  const viewerCount = users.filter(u => u.role === 'viewer').length

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return u.display_name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  })

  async function createUser(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, display_name: displayName, password, role }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { toast.error(data.error || 'Failed to create user'); return }
    setUsers(prev => [...prev, data])
    setEmail(''); setDisplayName(''); setPassword(''); setRole('viewer')
    setShowForm(false)
    toast.success(`${data.display_name} created.`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 px-1 pb-2 border-b border-zinc-800 flex-wrap">
        <span className="text-[10px] font-mono text-zinc-600"><span className="text-red-500">{ownerCount}</span> owner{ownerCount !== 1 ? 's' : ''}</span>
        <span className="text-[10px] font-mono text-zinc-600"><span className="text-red-800">{adminCount}</span> admin{adminCount !== 1 ? 's' : ''}</span>
        <span className="text-[10px] font-mono text-zinc-600"><span className="text-blue-800">{lawyerCount}</span> lawyer{lawyerCount !== 1 ? 's' : ''}</span>
        <span className="text-[10px] font-mono text-zinc-600"><span className="text-amber-800">{counsellorCount}</span> counsellor{counsellorCount !== 1 ? 's' : ''}</span>
        <span className="text-[10px] font-mono text-zinc-600"><span className="text-zinc-400">{viewerCount}</span> viewer{viewerCount !== 1 ? 's' : ''}</span>
        <span className="text-[10px] font-mono text-zinc-700 ml-auto">{users.length} total</span>
      </div>

      {showForm && canManageUsers ? (
        <div className="border border-zinc-700 bg-zinc-950 p-5">
          <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4">New User</p>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Display Name"><input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required className="admin-input" /></FormField>
              <FormField label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="admin-input" /></FormField>
              <FormField label="Password"><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="admin-input" /></FormField>
              <FormField label="Role">
                <select value={role} onChange={e => setRole(e.target.value as Role)} className="admin-input">
                  <option value="viewer">viewer</option>
                  <option value="lawyer">lawyer</option>
                  <option value="counsellor">counsellor</option>
                  {canAssignPrivilegedRoles && <option value="admin">admin</option>}
                  {canAssignPrivilegedRoles && <option value="owner">owner</option>}
                </select>
              </FormField>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={creating} className="admin-button"><UserPlus className="w-3 h-3" />{creating ? 'Creating...' : 'Create User'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-zinc-600 hover:text-zinc-400 text-[11px] font-mono tracking-widest uppercase transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {canManageUsers && <button onClick={() => setShowForm(true)} className="admin-button"><Plus className="w-3 h-3" /> Add User</button>}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-700" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by name or role..." className="w-full bg-black border border-zinc-800 text-zinc-300 pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700 transition-colors" />
          </div>
        </div>
      )}

      <div className="space-y-1">
        {filtered.map(user => {
          const isMe = user.id === currentUserId
          const oc = overrideCounts[user.id] ?? 0
          return (
            <Link key={user.id} href={`/admin/users/${user.id}`} className="flex items-center justify-between border border-zinc-800 bg-zinc-950 px-5 py-4 hover:border-zinc-700 transition-colors group">
              <div>
                <p className="text-sm font-mono text-zinc-300">{user.display_name}{isMe && <span className="ml-2 text-[9px] text-zinc-600">(you)</span>}</p>
                <p className="text-[10px] font-mono text-zinc-600 mt-0.5">Joined {formatDate(user.created_at)}{oc > 0 && <span className="ml-2 text-zinc-500">· {oc} override{oc !== 1 ? 's' : ''}</span>}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-[11px] font-mono tracking-widest uppercase ${ROLE_COLORS[user.role]}`}>{user.role}</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
              </div>
            </Link>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-zinc-700 font-mono py-8 text-center">{search ? 'No users match your search.' : 'No users.'}</p>}
      </div>
    </div>
  )
}

function BansTab({ bans: initialBans, users }: { bans: BanType[]; users: UserProfile[] }) {
  const [bans, setBans] = useState(initialBans)
  const [type, setType] = useState<'user' | 'ip'>('ip')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [expires, setExpires] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const userMap = Object.fromEntries(users.map(u => [u.id, u.display_name]))

  async function addBan(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/bans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value: value.trim(), reason: reason.trim() || null, expires_at: expires || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error || 'Failed'); return }
    setBans(prev => [data, ...prev])
    setValue(''); setReason(''); setExpires('')
    toast.success(`${type === 'ip' ? 'IP' : 'User'} banned.`)
  }

  async function removeBan(id: string) {
    setRemoving(id)
    const res = await fetch(`/api/admin/bans/${id}`, { method: 'DELETE' })
    setRemoving(null)
    if (!res.ok) { toast.error('Failed to remove ban'); return }
    setBans(prev => prev.filter(b => b.id !== id))
    toast.success('Ban removed.')
  }

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4">Add Ban</p>
        <form onSubmit={addBan} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Type"><select value={type} onChange={e => { setType(e.target.value as 'user' | 'ip'); setValue('') }} className="admin-input"><option value="ip">IP Address</option><option value="user">User</option></select></FormField>
            <FormField label={type === 'ip' ? 'IP Address' : 'User'}>
              {type === 'ip' ? <input type="text" value={value} onChange={e => setValue(e.target.value)} required placeholder="e.g. 1.2.3.4" className="admin-input" /> : <select value={value} onChange={e => setValue(e.target.value)} required className="admin-input"><option value="">Select user…</option>{users.filter(u => u.role !== 'admin' && u.role !== 'owner').map(u => <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>)}</select>}
            </FormField>
            <FormField label="Reason (optional)"><input type="text" value={reason} onChange={e => setReason(e.target.value)} className="admin-input" /></FormField>
            <FormField label="Expires (optional)"><input type="datetime-local" value={expires} onChange={e => setExpires(e.target.value)} className="admin-input" /></FormField>
          </div>
          <button type="submit" disabled={saving || !value} className="flex items-center gap-2 px-4 py-2 border border-red-900 text-red-700 hover:border-red-700 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-40"><Ban className="w-3 h-3" />{saving ? 'Banning...' : 'Ban'}</button>
        </form>
      </div>
      <div className="space-y-1">
        {bans.length === 0 && <p className="text-sm text-zinc-700 font-mono py-8 text-center">No active bans.</p>}
        {bans.map(ban => <div key={ban.id} className="flex items-center justify-between border border-zinc-800 bg-zinc-950 px-5 py-3"><div><div className="flex items-center gap-2"><span className={`text-[10px] font-mono tracking-widest uppercase ${ban.type === 'ip' ? 'text-amber-800' : 'text-red-800'}`}>{ban.type}</span><span className="text-sm font-mono text-zinc-300">{ban.type === 'user' ? (userMap[ban.value] ?? ban.value) : ban.value}</span></div><p className="text-[10px] font-mono text-zinc-600 mt-0.5">{ban.reason && <span className="mr-2">{ban.reason}</span>}{ban.expires_at ? `Expires ${formatDateTime(ban.expires_at)}` : 'Permanent'}<span className="ml-2">· Added {formatDate(ban.created_at)}</span></p></div><button onClick={() => removeBan(ban.id)} disabled={removing === ban.id} className="text-zinc-700 hover:text-red-700 transition-colors disabled:opacity-40 p-1" title="Remove ban"><X className="w-3.5 h-3.5" /></button></div>)}
      </div>
    </div>
  )
}

const ACTION_LABELS: Record<string, string> = {
  create_user: 'Created user',
  delete_user: 'Deleted user',
  update_user_profile: 'Updated user profile',
  update_user_role: 'Changed user role',
  reset_password: 'Reset password',
  create_incident: 'Created incident',
  create_tracker_session: 'Created tracker session',
  create_document: 'Uploaded document',
  create_ban: 'Banned',
  remove_ban: 'Unbanned',
  update_config: 'Updated config',
  update_lockdown_pin: 'Updated lockdown PIN',
  lockdown_enable: 'Enabled lockdown',
  lockdown_disable: 'Disabled lockdown',
  lockdown_disable_pin: 'Disabled lockdown via PIN',
}

function ActivityTab({ logs }: { logs: ActivityLog[] }) {
  const [search, setSearch] = useState('')
  const filtered = logs.filter(l => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (l.display_name ?? '').toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || (l.ip_address ?? '').includes(q)
  })
  return <div className="space-y-4"><div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-700" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter logs…" className="w-full bg-black border border-zinc-800 text-zinc-300 pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700 transition-colors" /></div><div className="space-y-px">{filtered.length === 0 && <p className="text-sm text-zinc-700 font-mono py-8 text-center">No activity yet.</p>}{filtered.map(log => <div key={log.id} className="flex items-start gap-4 border border-zinc-800 bg-zinc-950 px-5 py-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-mono text-zinc-300">{log.display_name ?? <span className="text-zinc-600">system</span>}</span><span className="text-[10px] font-mono text-zinc-500">{ACTION_LABELS[log.action] ?? log.action}</span>{log.resource_type && <span className="text-[10px] font-mono text-zinc-700">{log.resource_type}</span>}</div>{log.ip_address && <p className="text-[10px] font-mono text-amber-700 mt-0.5">IP: {log.ip_address}</p>}{log.metadata && <p className="text-[10px] font-mono text-zinc-700 mt-0.5 break-words [overflow-wrap:anywhere]">{Object.entries(log.metadata).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</p>}</div><span className="text-[10px] font-mono text-zinc-600 shrink-0">{formatDateTime(log.created_at)}</span></div>)}</div></div>
}

function ConfigTab({ config: initialConfig }: { config: Record<string, string> }) {
  const [cfg, setCfg] = useState(initialConfig)
  const [saving, setSaving] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)

  async function saveKey(key: string, value: string) {
    setSaving(key)
    const res = await fetch('/api/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
    setSaving(null)
    if (!res.ok) { toast.error('Failed to save'); return }
    setCfg(prev => ({ ...prev, [key]: value }))
    toast.success('Saved.')
  }

  async function savePin(e: FormEvent) {
    e.preventDefault()
    setSaving('pin')
    const res = await fetch('/api/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'lockdown_pin', value: pin }) })
    setSaving(null)
    if (!res.ok) { toast.error('Failed to save PIN'); return }
    setPin(''); setPinSaved(true); toast.success('Emergency PIN saved.')
  }

  return <div className="space-y-8"><div className="border border-zinc-800 bg-zinc-950 p-5 space-y-4"><p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Site Identity</p>{(['site_name', 'site_description'] as const).map(key => <ConfigField key={key} label={key === 'site_name' ? 'Site Name' : 'Site Description'} value={cfg[key] ?? ''} onSave={v => saveKey(key, v)} saving={saving === key} />)}</div><div className="border border-zinc-800 bg-zinc-950 p-5 space-y-4"><p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Lockdown Settings</p><ConfigField label="Lockdown Message" value={cfg.lockdown_message ?? ''} onSave={v => saveKey('lockdown_message', v)} saving={saving === 'lockdown_message'} /><div className="space-y-2"><label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Emergency PIN</label><p className="text-[10px] font-mono text-zinc-700">{cfg.lockdown_pin_hash ? '••• PIN is set. Enter a new one to replace it.' : 'No PIN set. Set one before enabling lockdown.'}</p><form onSubmit={savePin} className="flex gap-2"><input type="password" value={pin} onChange={e => { setPin(e.target.value); setPinSaved(false) }} placeholder="New PIN" minLength={6} className="admin-input" /><button type="submit" disabled={saving === 'pin' || !pin} className="px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-zinc-500 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-40">{saving === 'pin' ? '…' : pinSaved ? '✓' : 'Set'}</button></form></div></div></div>
}

function ConfigField({ label, value: initial, onSave, saving }: { label: string; value: string; onSave: (v: string) => void; saving: boolean }) {
  const [val, setVal] = useState(initial)
  const dirty = val !== initial
  return <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">{label}</label><div className="flex gap-2"><input type="text" value={val} onChange={e => setVal(e.target.value)} className="admin-input" /><button onClick={() => onSave(val)} disabled={saving || !dirty} className="px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-zinc-500 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-40">{saving ? '…' : 'Save'}</button></div></div>
}

function LockdownTab({ config }: { config: Record<string, string> }) {
  const [active, setActive] = useState(config.lockdown_mode === 'true')
  const [loading, setLoading] = useState(false)
  const hasPin = !!config.lockdown_pin_hash

  async function enableLockdown() {
    if (!hasPin) { toast.error('Set an emergency PIN in the Config tab first.'); return }
    if (!confirm('Enable lockdown? Everyone including admins will be locked out until the emergency PIN is used at /unlock.')) return
    setLoading(true)
    const res = await fetch('/api/admin/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'lockdown_mode', value: 'true' }) })
    setLoading(false)
    if (res.ok) { setActive(true); toast.success('Lockdown enabled. The site is now locked.') }
    else toast.error('Failed to enable lockdown')
  }

  return <div className="space-y-6"><div className={`border p-5 ${active ? 'border-red-900 bg-red-950/20' : 'border-zinc-800 bg-zinc-950'}`}><div className="flex items-center gap-3 mb-3"><div className={`w-2 h-2 rounded-full ${active ? 'bg-red-600 animate-pulse' : 'bg-zinc-700'}`} /><span className={`text-sm font-mono tracking-widest uppercase ${active ? 'text-red-500' : 'text-zinc-400'}`}>Lockdown {active ? 'ACTIVE' : 'Inactive'}</span></div>{active ? <p className="text-[11px] font-mono text-zinc-500">The site is locked. All users are redirected to the lockdown page. Only the emergency PIN at <code className="text-zinc-400">/unlock</code> can restore access.</p> : <p className="text-[11px] font-mono text-zinc-600">When enabled, all traffic is redirected to a blank lockdown page. Only someone with the emergency PIN can unlock the site. Admins cannot disable lockdown through this panel.</p>}</div><div className="border border-zinc-800 bg-zinc-950 px-5 py-4"><p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">Emergency PIN</p>{hasPin ? <p className="text-xs font-mono text-zinc-400">✓ PIN is configured. Go to <Link href="/unlock" className="underline hover:text-zinc-300 transition-colors">/unlock</Link> to test it.</p> : <p className="text-xs font-mono text-red-800">No PIN set. Configure one in the Config tab before enabling lockdown.</p>}</div>{!active && <button onClick={enableLockdown} disabled={loading} className="w-full flex items-center justify-center gap-2 border border-red-900 text-red-700 hover:border-red-600 hover:text-red-500 px-6 py-4 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-40"><AlertTriangle className="w-4 h-4" />{loading ? 'Enabling...' : 'Enable Lockdown'}</button>}<div className="border border-zinc-800 p-5 space-y-2"><p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3">How it works</p><ol className="space-y-2 text-[11px] font-mono text-zinc-600 list-decimal list-inside"><li>Set an emergency PIN in the Config tab (minimum 6 characters).</li><li>Click &quot;Enable Lockdown&quot; — the entire site immediately goes dark.</li><li>Even admin credentials cannot disable lockdown through the UI.</li><li>To restore access: navigate to <code className="text-zinc-500">/unlock</code> and enter the PIN.</li><li>The unlock page is always accessible and does not require a login.</li></ol></div></div>
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">{label}</label>{children}</div>
}

export default function AdminClient({ users, currentUserId, overrideCounts, bans, activityLogs, config, rolePermissions, allowedTabs, canManageUsers, canAssignPrivilegedRoles }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const TABS: TabOption[] = [
    { id: 'users', label: 'Users' },
    { id: 'roles', label: 'Roles' },
    { id: 'bans', label: 'Bans' },
    { id: 'activity', label: 'Activity' },
    { id: 'config', label: 'Config' },
    { id: 'lockdown', label: 'Lockdown' },
  ]
  const visibleTabs = TABS.filter(tab => allowedTabs.includes(tab.id))
  const requestedTab = searchParams.get('tab')
  const requested = requestedTab === null ? 'users' : requestedTab
  const normalizedTab = visibleTabs.find(tab => tab.id === requested)?.id ?? visibleTabs[0]?.id ?? 'users'
  const [tab, setTab] = useState<Tab>(normalizedTab)

  useEffect(() => {
    setTab(normalizedTab)
  }, [normalizedTab])

  function selectTab(nextTab: Tab) {
    setTab(nextTab)
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab === 'users') params.delete('tab')
    else params.set('tab', nextTab)
    const query = params.toString()
    router.replace(query ? `/admin?${query}` : '/admin')
  }

  return <div className="space-y-6"><style jsx global>{`.admin-input{width:100%;background:#000;border:1px solid rgb(39 39 42);color:rgb(228 228 231);padding:.5rem .75rem;font-size:.875rem;font-family:monospace;outline:none}.admin-input:focus{border-color:rgb(82 82 91)}.admin-button{display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem;border:1px solid rgb(63 63 70);color:rgb(161 161 170);font-size:11px;font-family:monospace;letter-spacing:.1em;text-transform:uppercase;transition:color .15s,border-color .15s}.admin-button:hover{border-color:rgb(113 113 122)}.admin-button:disabled{opacity:.4}`}</style><div className="flex border-b border-zinc-800 overflow-x-auto">{visibleTabs.map(t => <button key={t.id} onClick={() => selectTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-mono tracking-widest uppercase transition-colors border-b-2 -mb-px shrink-0 ${tab === t.id ? t.id === 'lockdown' ? 'border-red-800 text-red-600' : 'border-zinc-400 text-zinc-300' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}>{TAB_ICONS[t.id]}{t.label}{t.id === 'lockdown' && config.lockdown_mode === 'true' && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse inline-block" />}</button>)}</div>{tab === 'users' && <UsersTab users={users} currentUserId={currentUserId} overrideCounts={overrideCounts} canManageUsers={canManageUsers} canAssignPrivilegedRoles={canAssignPrivilegedRoles} />}{tab === 'roles' && <RolesTab initialRolePermissions={rolePermissions} />}{tab === 'bans' && <BansTab bans={bans} users={users} />}{tab === 'activity' && <ActivityTab logs={activityLogs} />}{tab === 'config' && <ConfigTab config={config} />}{tab === 'lockdown' && <LockdownTab config={config} />}</div>
}
