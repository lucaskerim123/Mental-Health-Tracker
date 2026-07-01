'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  hasPin: boolean
  active: boolean
}

export default function LockdownShortcut({ hasPin, active }: Props) {
  const [loading, setLoading] = useState(false)
  const [showPinPrompt, setShowPinPrompt] = useState(false)
  const [pin, setPin] = useState('')
  const [disabling, setDisabling] = useState(false)
  const router = useRouter()

  async function enableLockdown() {
    if (!hasPin) {
      toast.error('Set an emergency PIN first.')
      return
    }
    if (!confirm('Enable lockdown now? The emergency PIN must exist to unlock the site later.')) return

    setLoading(true)
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'lockdown_mode', value: 'true' }),
    })
    setLoading(false)

    if (!res.ok) {
      toast.error('Failed to enable lockdown.')
      return
    }

    toast.success('Lockdown enabled.')
    router.refresh()
  }

  async function disableLockdown(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim()) {
      toast.error('Enter the emergency PIN.')
      return
    }

    setDisabling(true)
    const res = await fetch('/api/lockdown/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin.trim() }),
    })
    setDisabling(false)

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error || 'Failed to disable lockdown.')
      return
    }

    setPin('')
    setShowPinPrompt(false)
    toast.success('Lockdown disabled.')
    router.refresh()
  }

  return (
    <div className={`flex items-center justify-between gap-3 border-b pb-3 ${active ? 'border-red-950/50' : 'border-zinc-900/80'}`}>
      <div className="min-w-0">
        <p className={`text-[9px] font-mono tracking-[0.25em] uppercase ${active ? 'text-red-700' : 'text-zinc-700'}`}>Lockdown</p>
        <p className="mt-1 text-[10px] font-mono text-zinc-600">
          {active ? 'Currently active.' : hasPin ? 'PIN ready.' : 'Configure PIN first.'}
        </p>
      </div>
      {active ? (
        <button
          type="button"
          onClick={() => setShowPinPrompt(true)}
          className="shrink-0 text-[10px] font-mono tracking-widest uppercase text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Disable
        </button>
      ) : (
        <button
          type="button"
          onClick={enableLockdown}
          disabled={loading || !hasPin}
          className="shrink-0 text-[10px] font-mono tracking-widest uppercase text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-40"
        >
          {loading ? 'Enabling...' : 'Enable'}
        </button>
      )}

      {showPinPrompt && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-4">
              <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500">Disable Lockdown</p>
              <p className="mt-2 text-[11px] font-mono text-zinc-600">
                Enter the emergency PIN to restore access.
              </p>
            </div>
            <form onSubmit={disableLockdown} className="space-y-3">
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Emergency PIN"
                className="w-full border border-zinc-800 bg-black px-3 py-2 text-sm font-mono text-zinc-200 outline-none focus:border-zinc-600"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPinPrompt(false); setPin('') }}
                  className="text-[10px] font-mono tracking-widest uppercase text-zinc-600 transition-colors hover:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disabling}
                  className="border border-red-900/50 px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-red-700 transition-colors hover:border-red-700 hover:text-red-500 disabled:opacity-40"
                >
                  {disabling ? 'Disabling...' : 'Disable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
