'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

export default function SetupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: name, email, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || data.message || `Setup failed (${res.status})`); setLoading(false); return }
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 border border-amber-900/60 mb-4">
            <ShieldCheck className="w-7 h-7 text-amber-700" strokeWidth={1.5} />
          </div>
          <p className="text-[10px] tracking-[0.4em] text-amber-700/80 uppercase font-mono">System Setup</p>
          <p className="text-[10px] tracking-[0.3em] text-zinc-600 uppercase font-mono mt-1">Create Administrator Account</p>
        </div>

        <div className="border border-zinc-800 bg-zinc-950 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-900/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-900/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-amber-900/60 transition-colors"
              />
            </div>

            {error && (
              <p className="text-[11px] text-red-700 font-mono border border-red-900/40 px-3 py-2 bg-red-950/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-950 hover:bg-amber-900 border border-amber-900/60 text-amber-200 py-2.5 text-[11px] tracking-[0.3em] uppercase font-mono transition-colors disabled:opacity-40"
            >
              {loading ? 'Initializing...' : 'Initialize System'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-zinc-700 font-mono mt-6 tracking-widest uppercase">
          Inaccessible after first admin is created
        </p>
      </div>
    </div>
  )
}
