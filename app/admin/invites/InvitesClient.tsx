'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { Copy, Trash2, Plus } from 'lucide-react'
import type { Invite, Role } from '@/lib/supabase/types'

interface Props {
  invites: Invite[]
  adminId: string
}

function generateToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

function inviteMessage(url: string, token: string) {
  const siteUrl = window.location.origin

  return `ACCESS DROP - PRIVATE ENTRY

The vault stirs... but it does not welcome the unworthy.
What you seek is not behind the door you see - it waits beneath the one you overlook.

Luke's tracker is sealed beyond: ${siteUrl}

The first door is not opened by the path in front of you.
Look for what the vault hides in plain sight.

Wake the mechanism.

When the door gives way, do not stop there.
The real entry is guarded by the seal.

Press the lock.
Let the hidden panel surface.

When it asks for proof, enter the code.

CODE: ${token}

This access is temporary. Keep it quiet.

If the vault refuses you, use the fallback:
${url}`
}

export default function InvitesClient({ invites: initialInvites, adminId }: Props) {
  const [invites, setInvites] = useState(initialInvites)
  const [role, setRole] = useState<Role>('viewer')
  const [expiryDays, setExpiryDays] = useState(7)
  const [creating, setCreating] = useState(false)

  async function createInvite() {
    setCreating(true)
    const token = generateToken()
    const expires_at = new Date(Date.now() + expiryDays * 86400000).toISOString()
    const supabase = createClient()
    const { error, data } = await supabase.from('invites').insert({
      token, created_by: adminId, role_to_assign: role, expires_at,
    }).select().single()
    if (error) { toast.error('Failed: ' + error.message) }
    else { setInvites(prev => [data, ...prev]); toast.success('Invite created.') }
    setCreating(false)
  }

  async function deleteInvite(invite: Invite) {
    if (!confirm('Revoke this invite?')) return
    const supabase = createClient()
    await supabase.from('invites').delete().eq('id', invite.id)
    setInvites(prev => prev.filter(i => i.id !== invite.id))
    toast.success('Revoked.')
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/join?token=${token}`
    navigator.clipboard.writeText(inviteMessage(url, token))
    toast.success('Invite message copied.')
  }

  return (
    <div>
      <div className="border border-zinc-800 bg-zinc-950 p-5 mb-6">
        <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4">New Invite</p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase">Role</label>
            <select value={role} onChange={e => setRole(e.target.value as Role)} className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] font-mono px-3 py-2 focus:outline-none">
              <option value="viewer">viewer</option>
              <option value="lawyer">lawyer</option>
              <option value="counsellor">counsellor</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase">Expires in</label>
            <select value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))} className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] font-mono px-3 py-2 focus:outline-none">
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
          <button onClick={createInvite} disabled={creating} className="flex items-center gap-2 mt-5 px-4 py-2 border border-zinc-700 text-zinc-400 hover:border-zinc-500 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-40">
            <Plus className="w-3 h-3" />
            {creating ? 'Creating...' : 'Generate Link'}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {invites.map(invite => {
          const expired = new Date(invite.expires_at) < new Date()
          const used = !!invite.used_by
          return (
            <div key={invite.id} className={`border px-4 py-3 flex items-center justify-between ${used ? 'border-zinc-800/50 opacity-50' : expired ? 'border-red-900/20' : 'border-zinc-800'} bg-zinc-950`}>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-zinc-400">{invite.role_to_assign}</span>
                  {used && <span className="text-[9px] font-mono text-zinc-600 tracking-widest uppercase">Used</span>}
                  {expired && !used && <span className="text-[9px] font-mono text-red-800 tracking-widest uppercase">Expired</span>}
                </div>
                <p className="text-[10px] font-mono text-zinc-600">Expires {formatDateTime(invite.expires_at)} · {invite.token.slice(0, 12)}...</p>
              </div>
              <div className="flex items-center gap-2">
                {!used && !expired && <button onClick={() => copyLink(invite.token)} className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"><Copy className="w-3.5 h-3.5" /></button>}
                <button onClick={() => deleteInvite(invite)} className="p-2 text-red-900 hover:text-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          )
        })}
        {!invites.length && <p className="text-sm text-zinc-700 font-mono py-8 text-center">No invites.</p>}
      </div>
    </div>
  )
}
