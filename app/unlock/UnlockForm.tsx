'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UnlockForm() {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/lockdown/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || 'Incorrect PIN')
      setPin('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Emergency PIN</label>
        <input
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          required
          autoFocus
          className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-zinc-600 transition-colors tracking-widest"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-red-700 font-mono text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading || !pin}
        className="w-full border border-zinc-700 text-zinc-400 hover:border-zinc-500 px-4 py-2 text-[11px] font-mono tracking-widest uppercase transition-colors disabled:opacity-40"
      >
        {loading ? 'Verifying...' : 'Unlock Site'}
      </button>
    </form>
  )
}
