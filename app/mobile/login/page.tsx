'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock } from 'lucide-react'

export default function MobileLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function getRedirectPath() {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')
    if (next && next.startsWith('/mobile') && !next.startsWith('//')) return next
    return '/mobile'
  }

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

    router.replace(getRedirectPath())
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-6">
        <section className="w-full rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-900/60 bg-red-950/20">
              <Lock className="h-7 w-7 text-red-700" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-red-700/80">Phone Access</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Mobile Login</h1>
            <p className="mt-2 text-xs font-mono text-zinc-600">Returns to the phone app, not dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="phone-input mt-2"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="phone-input mt-2"
              />
            </div>

            {error && <p className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs font-mono text-red-400">{error}</p>}

            <button type="submit" disabled={loading} className="w-full rounded-[1.5rem] border border-red-900/60 bg-red-950 px-5 py-4 text-sm font-semibold text-red-100 disabled:opacity-40">
              {loading ? 'Logging in...' : 'Login to Phone App'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
