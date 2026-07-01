'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import { toast } from 'sonner'

const HOLD_MS = 650

interface Props {
  isAdmin: boolean
  lockdownActive: boolean
  hasPin: boolean
  onNavigate?: () => void
  mobile?: boolean
}

export default function SecurePortalLink({ isAdmin, lockdownActive, hasPin, onNavigate, mobile = false }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPinPrompt, setShowPinPrompt] = useState(false)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const completedRef = useRef(false)

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    setHolding(false)
    setProgress(0)
    setMenuOpen(false)
    setShowPinPrompt(false)
    setPin('')
    startRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [pathname])

  function clearHold(resetProgress = true) {
    startRef.current = null
    setHolding(false)
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (resetProgress) setProgress(0)
  }

  function startHold() {
    if (!isAdmin || pathname !== '/dashboard') return
    if (holding) return

    completedRef.current = false
    startRef.current = performance.now()
    setHolding(true)
    setProgress(0)

    const tick = (now: number) => {
      if (startRef.current === null) return

      const pct = Math.min((now - startRef.current) / HOLD_MS, 1)
      setProgress(pct)

      if (pct >= 1) {
        completedRef.current = true
        clearHold(false)
        setMenuOpen(true)
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  function stopHold() {
    if (completedRef.current) return
    clearHold(true)
  }

  function openDisablePrompt() {
    setShowPinPrompt(true)
    setPin('')
  }

  function closeMenu() {
    setMenuOpen(false)
    setShowPinPrompt(false)
    setPin('')
  }

  async function enableLockdown() {
    if (!hasPin) {
      toast.error('Set an emergency PIN first.')
      return
    }
    if (!window.confirm('Enable lockdown now? The emergency PIN will be required to restore access.')) return

    setBusy(true)
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'lockdown_mode', value: 'true' }),
    })
    setBusy(false)

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error || 'Failed to enable lockdown.')
      return
    }

    closeMenu()
    toast.success('Lockdown enabled.')
    router.refresh()
  }

  async function disableLockdown(e: React.FormEvent) {
    e.preventDefault()
    if (!pin.trim()) {
      toast.error('Enter the emergency PIN.')
      return
    }

    setBusy(true)
    const res = await fetch('/api/lockdown/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin.trim() }),
    })
    setBusy(false)

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error || 'Failed to disable lockdown.')
      return
    }

    closeMenu()
    toast.success('Lockdown disabled.')
    router.refresh()
  }

  const content = (
    <div
      className="relative flex items-center gap-2"
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onContextMenu={e => e.preventDefault()}
      style={{ touchAction: 'none' }}
    >
      <Shield className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.5} />
      <span className={`text-[10px] tracking-[0.3em] uppercase font-mono ${mobile ? 'text-zinc-300' : 'text-zinc-300'} ${holding ? 'opacity-60' : ''}`}>
        Secure Portal
      </span>
      {holding && (
        <span className="absolute -bottom-1 left-0 h-px bg-red-600 transition-[width] duration-75" style={{ width: `${progress * 100}%` }} />
      )}
    </div>
  )

  return (
    <div className="relative inline-flex">
      <Link
        href="/dashboard"
        onClick={() => {
          closeMenu()
          onNavigate?.()
        }}
        className="flex items-center gap-2"
      >
        {content}
      </Link>

      {isAdmin && pathname === '/dashboard' && menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close secure portal menu"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={closeMenu}
          />
          <div className={`absolute left-0 top-[calc(100%+0.5rem)] z-50 w-64 border border-zinc-800 bg-zinc-950 p-4 shadow-2xl ${mobile ? 'max-w-[calc(100vw-2rem)]' : ''}`}>
            {!showPinPrompt ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500">
                    {lockdownActive ? 'Lockdown Active' : 'Lockdown Controls'}
                  </p>
                  <p className="mt-1 text-[11px] font-mono text-zinc-600">
                    {lockdownActive
                      ? 'Disable it here with the emergency PIN.'
                      : hasPin
                        ? 'Enable lockdown from this panel.'
                        : 'Set an emergency PIN before enabling lockdown.'}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="text-[10px] font-mono tracking-widest uppercase text-zinc-600 transition-colors hover:text-zinc-400"
                  >
                    Close
                  </button>
                  {lockdownActive ? (
                    <button
                      type="button"
                      onClick={openDisablePrompt}
                      className="border border-red-900/50 px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-red-700 transition-colors hover:border-red-700 hover:text-red-500"
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={enableLockdown}
                      disabled={busy || !hasPin}
                      className="border border-red-900/50 px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-red-700 transition-colors hover:border-red-700 hover:text-red-500 disabled:opacity-40"
                    >
                      {busy ? 'Enabling...' : 'Lockdown'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500">Disable Lockdown</p>
                  <p className="mt-1 text-[11px] font-mono text-zinc-600">Enter the emergency PIN to restore access.</p>
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
                      onClick={() => setShowPinPrompt(false)}
                      className="text-[10px] font-mono tracking-widest uppercase text-zinc-600 transition-colors hover:text-zinc-400"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="border border-red-900/50 px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-red-700 transition-colors hover:border-red-700 hover:text-red-500 disabled:opacity-40"
                    >
                      {busy ? 'Disabling...' : 'Disable'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
