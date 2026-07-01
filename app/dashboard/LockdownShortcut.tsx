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

  return (
    <div className={`flex items-center justify-between gap-3 border-b pb-3 ${active ? 'border-red-950/50' : 'border-zinc-900/80'}`}>
      <div className="min-w-0">
        <p className={`text-[9px] font-mono tracking-[0.25em] uppercase ${active ? 'text-red-700' : 'text-zinc-700'}`}>Lockdown</p>
        <p className="mt-1 text-[10px] font-mono text-zinc-600">
          {active ? 'Currently active.' : hasPin ? 'PIN ready.' : 'Configure PIN first.'}
        </p>
      </div>
      <button
        type="button"
        onClick={enableLockdown}
        disabled={loading || active || !hasPin}
        className="shrink-0 text-[10px] font-mono tracking-widest uppercase text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-40"
      >
        {loading ? 'Enabling...' : active ? 'Enabled' : 'Enable'}
      </button>
    </div>
  )
}
