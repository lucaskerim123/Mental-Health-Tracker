'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, ChevronRight, UserPlus, Search } from 'lucide-react'
import Link from 'next/link'
import type { UserProfile, Role } from '@/lib/supabase/types'
import { formatDate } from '@/lib/utils'

interface Props {
  users: UserProfile[]
  currentUserId: string
  overrideCounts: Record<string, number>
}

const ROLE_COLORS: Record<Role, string> = {
  admin: 'text-red-700',
  counsellor: 'text-amber-700',
  viewer: 'text-zinc-500',
}

export default function AdminClient({ users: initialUsers, currentUserId, overrideCounts }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [creating, setCreating] = useState(false)

  const adminCount = users.filter(u => u.role === 'admin').length
  const counsellorCount = users.filter(u => u.role === 'counsellor').length
  const viewerCount = users.filter(u => u.role === 'viewer').length

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return u.display_name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  })

  async function createUser(e: React.FormEvent) {
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
      {/* Stats row */}
      <div className="flex items-center gap-6 px-1 pb-2 border-b border-zinc-800">
        <span className="text-[10px] font-mono text-zinc-600">
          <span className="text-red-800">{adminCount}</span> admin{adminCount !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] font-mono text-zinc-600">
          <span className="text-amber-800">{counsellorCount}</span> counsellor{counsellorCount !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] font-mono text-zinc-600">
          <span className="text-zinc-400">{viewerCount}</span> viewer{viewerCount !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] font-mono text-zinc-700 ml-auto">{users.length} total</span>
      </div>

      {/* Create user form */}
      {showForm ? (
        <div className="border border-zinc-700 bg-zinc-950 p-5">
          <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4">New User</p>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as Role)}
                  className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none"
                >
                  <option value="viewer">viewer</option>
                  <option value="counsellor">counsellor</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-zinc-500 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-40"
              >
                <UserPlus className="w-3 h-3" />
                {creating ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-zinc-600 hover:text-zinc-400 text-[11px] font-mono tracking-widest uppercase transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-zinc-500 text-[11px] font-mono tracking-widest uppercase transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add User
          </button>
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-700" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by name or role..."
              className="w-full bg-black border border-zinc-800 text-zinc-300 pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700 transition-colors"
            />
          </div>
        </div>
      )}

      {/* User list */}
      <div className="space-y-1">
        {filtered.map(user => {
          const isMe = user.id === currentUserId
          const oc = overrideCounts[user.id] ?? 0
          return (
            <Link
              key={user.id}
              href={`/admin/users/${user.id}`}
              className="flex items-center justify-between border border-zinc-800 bg-zinc-950 px-5 py-4 hover:border-zinc-700 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-mono text-zinc-300">
                    {user.display_name}
                    {isMe && <span className="ml-2 text-[9px] text-zinc-600">(you)</span>}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-600 mt-0.5">
                    Joined {formatDate(user.created_at)}
                    {oc > 0 && (
                      <span className="ml-2 text-zinc-500">· {oc} override{oc !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-[11px] font-mono tracking-widest uppercase ${ROLE_COLORS[user.role]}`}>
                  {user.role}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
              </div>
            </Link>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-zinc-700 font-mono py-8 text-center">
            {search ? 'No users match your search.' : 'No users.'}
          </p>
        )}
      </div>
    </div>
  )
}
