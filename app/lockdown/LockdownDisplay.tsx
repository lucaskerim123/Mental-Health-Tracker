'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

const HOLD_MS = 3000

export default function LockdownDisplay({ message, siteName }: { message: string; siteName: string }) {
  const [progress, setProgress] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const router = useRouter()

  function startHold() {
    startRef.current = Date.now()
    function tick() {
      if (startRef.current === null) return
      const pct = Math.min((Date.now() - startRef.current) / HOLD_MS, 1)
      setProgress(pct)
      if (pct >= 1) {
        router.push('/unlock')
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function stopHold() {
    startRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setProgress(0)
  }

  const r = 62
  const circumference = 2 * Math.PI * r
  const holding = progress > 0

  return (
    <>
      <style>{`
        @keyframes lockPulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(220, 38, 38, 0.3)); }
          50% { filter: drop-shadow(0 0 40px rgba(220, 38, 38, 0.75)); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .lock-idle { animation: lockPulse 2.5s ease-in-out infinite; }
        .scanline { animation: scanline 8s linear infinite; }
      `}</style>

      <div className="min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center gap-14 px-4 select-none relative">

        {/* Subtle scanline effect */}
        <div className="scanline pointer-events-none absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-red-950/5 to-transparent" />

        {/* Padlock — hold it for 3 seconds */}
        <div
          className="relative flex items-center justify-center cursor-default"
          style={{ width: 160, height: 160 }}
          onMouseDown={startHold}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={e => { e.preventDefault(); startHold() }}
          onTouchEnd={stopHold}
        >
          {/* Progress ring — only visible while holding */}
          <svg
            width="160" height="160"
            viewBox="0 0 160 160"
            className="absolute inset-0"
            style={{ transform: 'rotate(-90deg)', opacity: holding ? 1 : 0, transition: 'opacity 0.15s' }}
          >
            <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(220,38,38,0.2)" strokeWidth="3" />
            <circle
              cx="80" cy="80" r={r}
              fill="none"
              stroke="rgb(220 38 38)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
            />
          </svg>

          {/* The padlock itself */}
          <Lock
            strokeWidth={0.65}
            className={holding ? '' : 'lock-idle'}
            style={{
              width: 96,
              height: 96,
              color: holding
                ? `rgb(${Math.floor(220 + 35 * progress)}, ${Math.floor(38 * (1 - progress * 0.8))}, ${Math.floor(38 * (1 - progress * 0.8))})`
                : 'rgb(185, 28, 28)',
              filter: holding
                ? `drop-shadow(0 0 ${12 + 36 * progress}px rgba(220, 38, 38, ${0.6 + 0.4 * progress}))`
                : undefined,
              transition: holding ? 'none' : 'color 0.6s, filter 0.6s',
            }}
          />
        </div>

        {/* Text block */}
        <div className="text-center space-y-5 relative z-10">
          <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-red-900">
            {siteName}
          </p>
          <h1 className="font-mono text-3xl sm:text-4xl font-light tracking-[0.35em] uppercase text-red-600">
            LOCKDOWN
          </h1>
          <div className="w-16 h-px bg-red-900 mx-auto" />
          <p className="font-mono text-sm text-zinc-600 max-w-xs mx-auto leading-relaxed tracking-wide">
            {message}
          </p>
        </div>
      </div>
    </>
  )
}
