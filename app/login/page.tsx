'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronRight, KeyRound, Lock, ShieldAlert } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)
  const [inviteVisible, setInviteVisible] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const router = useRouter()

  function getRedirectPath() {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//')) return next
    if (navigator.userAgent.includes('MentalHealthTrackerApp')) return '/mobile'
    return '/dashboard'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('ACCESS DENIED — BAD SEAL')
      setLoading(false)
      return
    }
    router.push(getRedirectPath())
    router.refresh()
  }

  function handleInviteContinue() {
    const code = inviteCode.trim()
    if (!code) return
    router.push(`/join?token=${encodeURIComponent(code)}`)
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-zinc-300">
      <div className={`vault-bg vault-bg-closed transition-all duration-[1200ms] ease-out ${vaultOpen ? 'scale-110 opacity-0 blur-sm' : 'scale-100 opacity-100 blur-0'}`} />
      <div className={`vault-bg vault-bg-open transition-all duration-[1400ms] ease-out ${vaultOpen ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-0 blur-sm'}`} />
      <div className="fixed inset-0 bg-black/35" />
      <div className={`fixed inset-0 bg-[radial-gradient(circle_at_63%_43%,rgba(59,130,246,.32)_0%,rgba(59,130,246,.14)_12%,transparent_30%)] transition-opacity duration-700 ${vaultOpen ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`fixed inset-0 bg-white transition-opacity duration-500 ${vaultOpen ? 'animate-vault-flash' : 'opacity-0'}`} />
      <div className="fixed inset-0 bg-gradient-to-b from-black/5 via-transparent to-black" />
      <div className="fixed inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px)] bg-[length:100%_4px]" />

      <section className="relative z-10 min-h-screen px-4 py-6 sm:py-8">
        {!vaultOpen && (
          <button
            type="button"
            onClick={() => setVaultOpen(true)}
            aria-label="Open login panel"
            className="group absolute left-[67%] top-[26%] h-[21%] w-[20%] rounded-[22px] outline-none sm:left-[61%] sm:top-[28%] sm:h-[26%] sm:w-[11%] lg:left-[62%] lg:top-[33%] lg:h-[28%] lg:w-[9%]"
          >
            <span className="absolute inset-0 rounded-[22px] border border-blue-400/10 bg-blue-950/5 opacity-20 transition-all group-hover:border-blue-300/65 group-hover:bg-blue-500/10 group-hover:opacity-75 group-hover:shadow-[0_0_55px_rgba(37,99,235,.34)]" />
          </button>
        )}

        <div className={`mx-auto grid w-full max-w-6xl pt-[40vh] transition-all duration-1000 ease-out sm:min-h-[calc(100vh-4rem)] sm:items-end lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-0 ${vaultOpen ? 'opacity-100 translate-x-0 translate-y-0 delay-500' : 'pointer-events-none opacity-0 translate-x-8 translate-y-8'}`}>
          <div className="hidden lg:block" />

          <div className="w-full lg:max-w-sm lg:justify-self-end">
            <div className="mb-5 text-center">
              <button
                type="button"
                onClick={() => setInviteVisible(v => !v)}
                aria-label="Toggle hidden invite entry"
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border bg-black/75 shadow-[0_0_35px_rgba(37,99,235,.2)] backdrop-blur-md transition-all ${inviteVisible ? 'border-blue-500 text-blue-300 shadow-[0_0_35px_rgba(37,99,235,.38)]' : 'border-blue-900/60 text-blue-300/80 hover:border-blue-500/80 hover:shadow-[0_0_45px_rgba(37,99,235,.34)]'}`}
              >
                <Lock className="h-6 w-6" />
              </button>
              <p className="text-[10px] font-mono uppercase tracking-[0.48em] text-blue-500/80">Vault Entry</p>
              <h1 className="mt-3 text-lg font-mono uppercase tracking-[0.35em] text-zinc-200">Restricted Access</h1>
              <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-600">Identity seal required</p>
            </div>

            <div className="relative border border-zinc-800 bg-black/82 p-1 shadow-[0_0_80px_rgba(0,0,0,.75)] backdrop-blur-md">
              <div className="absolute -left-px -top-px h-8 w-8 border-l border-t border-blue-900/70" />
              <div className="absolute -right-px -top-px h-8 w-8 border-r border-t border-blue-900/70" />
              <div className="absolute -bottom-px -left-px h-8 w-8 border-b border-l border-blue-900/70" />
              <div className="absolute -bottom-px -right-px h-8 w-8 border-b border-r border-blue-900/70" />
              <div className="border border-zinc-900 bg-zinc-950/72 p-5 sm:p-7">
                <div className="mb-5 flex items-center gap-2 border-b border-zinc-900 pb-4">
                  <ShieldAlert className="h-4 w-4 text-blue-500/75" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-600">Identity Seal</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <VaultField label="Access ID">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="vault-input-blue" autoComplete="email" />
                  </VaultField>

                  <VaultField label="Passphrase">
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="vault-input-blue" autoComplete="current-password" />
                  </VaultField>

                  {error && <p className="border border-red-900/50 bg-red-950/20 px-3 py-2 text-[11px] font-mono uppercase tracking-widest text-red-600">{error}</p>}

                  <button type="submit" disabled={loading} className="group relative w-full overflow-hidden border border-blue-900/70 bg-blue-950/50 px-4 py-3 text-[11px] font-mono uppercase tracking-[0.32em] text-blue-100 transition-all hover:border-blue-700 hover:bg-blue-900/60 disabled:opacity-40">
                    <span className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-blue-400/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    {loading ? 'Checking Seal...' : 'Open Vault'}
                  </button>
                </form>
              </div>
            </div>

            <div className={`overflow-hidden transition-all duration-500 ${inviteVisible ? 'max-h-72 opacity-100 mt-4 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'}`}>
              <div className="relative border border-blue-950/60 bg-black/90 p-4 shadow-[0_0_35px_rgba(37,99,235,.12)] backdrop-blur-md">
                <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-blue-800/70 to-transparent" />
                <div className="mb-3 flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-blue-500/75" />
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-blue-500/80">Hidden Entry</p>
                    <p className="mt-1 text-[10px] font-mono text-zinc-700">Place the key where it belongs.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInviteContinue()} placeholder="Enter thy code" className="vault-input-blue flex-1 text-xs" />
                  <button type="button" onClick={handleInviteContinue} className="border border-zinc-800 px-3 text-zinc-600 transition-colors hover:border-blue-900/70 hover:text-blue-500">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-5 pb-8 text-center text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-700">Public Entry Disabled</p>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .vault-bg{position:fixed;inset:0;background-size:cover;background-position:center top;background-repeat:no-repeat}.vault-bg-closed{background-image:url('/vault-door.jpg')}.vault-bg-open{background-image:url('/vault-door-open.jpg');background-size:auto 43vh;background-position:center top}.vault-input-blue{width:100%;background:#020202;border:1px solid rgb(39 39 42);color:rgb(228 228 231);padding:.7rem .8rem;font-size:.875rem;font-family:monospace;outline:none;transition:border-color .18s,box-shadow .18s,background .18s}.vault-input-blue:focus{border-color:rgba(37,99,235,.82);box-shadow:0 0 0 1px rgba(37,99,235,.3),0 0 26px rgba(37,99,235,.13);background:#000}.vault-input-blue::placeholder{color:rgb(63 63 70)}@media (min-width:768px){.vault-bg{background-size:cover;background-position:center center}}@keyframes vaultFlash{0%{opacity:0}22%{opacity:.18}100%{opacity:0}}.animate-vault-flash{animation:vaultFlash 900ms ease-out forwards}
      `}</style>
    </main>
  )
}

function VaultField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><label className="text-[10px] font-mono uppercase tracking-[0.33em] text-zinc-600">{label}</label>{children}</div>
}
