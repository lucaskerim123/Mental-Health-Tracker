'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const HOLD_MS = 650

interface Props {
  isAdmin: boolean
  showLockdownControl?: boolean
  onLockdownControl?: () => void
  mobile?: boolean
}

export default function SecurePortalLink({ isAdmin, showLockdownControl = false, onLockdownControl, mobile = false }: Props) {
  const pathname = usePathname()
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showPrompt, setShowPrompt] = useState(false)
  const [pin, setPin] = useState('')
  const [disabling, setDisabling] = useState(false)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const completedRef = useRef(false)

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

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
        if (showLockdownControl) {
          onLockdownControl?.()
        } else {
          setShowPrompt(true)
        }
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
    setShowPrompt(false)
    toast.success('Lockdown disabled.')
    window.location.reload()
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
    <>
      <Link href="/dashboard" className="flex items-center gap-2">
        {content}
      </Link>

      {isAdmin && showPrompt && pathname === '/dashboard' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500">Disable Lockdown</p>
            <p className="mt-2 text-[11px] font-mono text-zinc-600">Enter the emergency PIN to restore access.</p>
            <form onSubmit={disableLockdown} className="mt-4 space-y-3">
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
                  onClick={() => { setShowPrompt(false); setPin('') }}
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
    </>
  )
}
