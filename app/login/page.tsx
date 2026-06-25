'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Access denied. Check your credentials.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="vault-bg relative min-h-screen flex items-center justify-center p-4 bg-black">
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 border border-red-900/60 mb-4 vault-glow">
            <Lock className="w-7 h-7 text-red-700" strokeWidth={1.5} />
          </div>
          <p className="text-[10px] tracking-[0.4em] text-red-700/80 uppercase font-mono">Restricted Access</p>
          <p className="text-[10px] tracking-[0.3em] text-zinc-600 uppercase font-mono mt-1">Authorised Personnel Only</p>
        </div>
        <div className="border border-zinc-800 vault-glow bg-zinc-950 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Identifier</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-900/60 transition-colors"
                autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Passphrase</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-900/60 transition-colors"
                autoComplete="current-password" />
            </div>
            {error && <p className="text-[11px] text-red-700 font-mono border border-red-900/40 px-3 py-2 bg-red-950/20">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-red-950 hover:bg-red-900 border border-red-900/60 text-red-200 py-2.5 text-[11px] tracking-[0.3em] uppercase font-mono transition-colors disabled:opacity-40">
              {loading ? 'Verifying...' : 'Request Access'}
            </button>
          </form>
        </div>
        <p className="text-center text-[10px] text-zinc-700 font-mono mt-6 tracking-widest uppercase">No public registration</p>
      </div>
    </div>
  )
}
