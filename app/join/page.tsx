'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, AlertTriangle, ChevronRight } from 'lucide-react'

const ALLOWED_INVITE_ROLES = ['viewer', 'lawyer', 'counsellor']

function JoinForm() {
  const searchParams = useSearchParams()
  const urlToken = searchParams.get('token')
  const router = useRouter()

  const [step, setStep] = useState<'enter-code' | 'validating' | 'register' | 'error'>(urlToken ? 'validating' : 'enter-code')
  const [token, setToken] = useState(urlToken ?? '')
  const [codeInput, setCodeInput] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [invite, setInvite] = useState<{ id: string; role_to_assign: string } | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function validateToken(tok: string) {
    if (!tok.trim()) { setTokenError('Please enter an invite code.'); setStep('error'); return }
    setStep('validating')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('invites')
      .select('id, role_to_assign, used_by, expires_at')
      .eq('token', tok.trim())
      .single()

    if (error || !data) { setTokenError('Invalid invite code.'); setStep('error'); return }
    if (data.used_by) { setTokenError('This invite has already been used.'); setStep('error'); return }
    if (new Date(data.expires_at) < new Date()) { setTokenError('This invite has expired.'); setStep('error'); return }
    if (!ALLOWED_INVITE_ROLES.includes(data.role_to_assign)) { setTokenError('This invite role is no longer allowed.'); setStep('error'); return }

    setToken(tok.trim())
    setInvite(data)
    setStep('register')
  }

  useEffect(() => {
    if (urlToken) validateToken(urlToken)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passphrases do not match.'); return }
    if (password.length < 8) { setError('Passphrase must be at least 8 characters.'); return }
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, invite_token: token } },
    })
    if (error) { setError(error.message); setSubmitting(false); return }
    router.push('/login?joined=1')
  }

  if (step === 'enter-code') return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 border border-red-900/60 mb-4 vault-glow">
            <Lock className="w-6 h-6 text-red-700" strokeWidth={1.5} />
          </div>
          <p className="text-[10px] tracking-[0.4em] text-red-700/80 uppercase font-mono">Invite Required</p>
          <p className="text-[10px] tracking-[0.3em] text-zinc-600 uppercase font-mono mt-1">Enter your invite code</p>
        </div>
        <div className="border border-zinc-800 vault-glow bg-zinc-950 p-8">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Invite Code</label>
              <input
                type="text"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && validateToken(codeInput)}
                placeholder="Paste your code here"
                autoFocus
                className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-900/60 transition-colors placeholder:text-zinc-700"
              />
            </div>
            <button
              type="button"
              onClick={() => validateToken(codeInput)}
              className="w-full flex items-center justify-center gap-2 bg-red-950 hover:bg-red-900 border border-red-900/60 text-red-200 py-2.5 text-[11px] tracking-[0.3em] uppercase font-mono transition-colors"
            >
              Continue
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (step === 'validating') return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <p className="text-zinc-600 font-mono text-sm tracking-widest">VERIFYING...</p>
    </div>
  )

  if (step === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="text-center border border-red-900/40 p-8 max-w-sm w-full vault-glow">
        <AlertTriangle className="w-8 h-8 text-red-700 mx-auto mb-4" />
        <p className="text-red-700 font-mono text-sm mb-4">{tokenError}</p>
        <button
          type="button"
          onClick={() => { setStep('enter-code'); setTokenError('') }}
          className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 tracking-widest uppercase transition-colors"
        >
          Try another code
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Lock className="w-8 h-8 text-red-700 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-[10px] tracking-[0.4em] text-red-700/80 uppercase font-mono">Create Account</p>
          <p className="text-[10px] text-zinc-600 font-mono mt-1">Role: <span className="text-zinc-400">{invite?.role_to_assign}</span></p>
        </div>
        <div className="border border-zinc-800 vault-glow bg-zinc-950 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Display Name', type: 'text', value: displayName, set: setDisplayName },
              { label: 'Email', type: 'email', value: email, set: setEmail },
              { label: 'Passphrase', type: 'password', value: password, set: setPassword },
              { label: 'Confirm Passphrase', type: 'password', value: confirm, set: setConfirm },
            ].map(({ label, type, value, set }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={e => set(e.target.value)}
                  required
                  className="w-full bg-black border border-zinc-800 text-zinc-200 px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-900/60"
                />
              </div>
            ))}
            {error && <p className="text-[11px] text-red-700 font-mono border border-red-900/40 px-3 py-2 bg-red-950/20">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-950 hover:bg-red-900 border border-red-900/60 text-red-200 py-2.5 text-[11px] tracking-[0.3em] uppercase font-mono transition-colors disabled:opacity-40"
            >
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return <Suspense fallback={null}><JoinForm /></Suspense>
}
