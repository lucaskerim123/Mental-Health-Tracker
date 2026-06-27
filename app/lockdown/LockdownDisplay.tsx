'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

const HOLD_MS = 3000

export default function LockdownDisplay({
  siteName,
  message,
}: {
  siteName: string
  message: string
}) {
  const router = useRouter()

  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)

  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function clearHoldState(resetProgress = true) {
    startRef.current = null
    setHolding(false)

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (resetProgress) setProgress(0)
  }

  function startHold() {
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
        clearHoldState(false)
        router.push('/unlock')
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  function stopHold() {
    if (completedRef.current) return
    clearHoldState(true)
  }

  const radius = 96
  const circumference = 2 * Math.PI * radius
  const progressOffset = circumference * (1 - progress)

  return (
    <>
      <style>{`
        @keyframes lockBreath {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 18px rgba(220, 38, 38, 0.28));
          }
          50% {
            transform: scale(1.045);
            filter: drop-shadow(0 0 42px rgba(220, 38, 38, 0.78));
          }
        }

        @keyframes scanlineDrift {
          0% {
            transform: translateY(-25vh);
          }
          100% {
            transform: translateY(125vh);
          }
        }

        @keyframes backgroundPulse {
          0%, 100% {
            opacity: 0.14;
          }
          50% {
            opacity: 0.28;
          }
        }

        .lock-breath {
          animation: lockBreath 3.2s ease-in-out infinite;
        }

        .scanline {
          animation: scanlineDrift 8s linear infinite;
        }

        .bg-pulse {
          animation: backgroundPulse 4s ease-in-out infinite;
        }
      `}</style>

      <div className="relative min-h-screen overflow-hidden bg-black text-red-600 select-none">
        <div className="bg-pulse pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,0,0,0.22),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_bottom,transparent_0%,rgba(255,0,0,0.35)_50%,transparent_100%)] [background-size:100%_4px]" />
        <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent via-red-700/10 to-transparent" />

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div
            role="button"
            tabIndex={0}
            aria-label="Unlock lockdown screen"
            className="relative flex items-center justify-center"
            style={{ width: 260, height: 260, touchAction: 'none' }}
            onPointerDown={(e) => {
              e.preventDefault()
              startHold()
            }}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg
              width="260"
              height="260"
              viewBox="0 0 260 260"
              className="absolute inset-0"
              style={{
                transform: 'rotate(-90deg)',
                opacity: holding ? 1 : 0,
                transition: 'opacity 140ms ease',
              }}
            >
              <circle
                cx="130"
                cy="130"
                r={radius}
                fill="none"
                stroke="rgba(220,38,38,0.14)"
                strokeWidth="6"
              />
              <circle
                cx="130"
                cy="130"
                r={radius}
                fill="none"
                stroke="rgb(239 68 68)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                style={{
                  filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.75))',
                  transition: holding ? 'none' : 'stroke-dashoffset 120ms linear',
                }}
              />
            </svg>

            <div
              className={!holding ? 'lock-breath' : ''}
              style={{
                transition: 'transform 120ms linear, filter 120ms linear, opacity 120ms linear',
                transform: holding ? `scale(${1 + progress * 0.08})` : undefined,
                filter: holding
                  ? `drop-shadow(0 0 ${28 + progress * 30}px rgba(255, 40, 40, ${0.72 + progress * 0.28}))`
                  : undefined,
              }}
            >
              <Lock
                strokeWidth={1.35}
                style={{
                  width: 150,
                  height: 150,
                  color: holding ? `rgb(255, ${54 - Math.round(progress * 10)}, ${54 - Math.round(progress * 10)})` : 'rgb(220, 38, 38)',
                }}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <h1 className="font-mono text-4xl font-light uppercase tracking-[0.55em] text-red-600 sm:text-5xl">
              LOCKDOWN
            </h1>

            <div className="mt-5 h-px w-40 bg-red-800" />

            <p className="mt-7 max-w-xl font-mono text-sm uppercase tracking-[0.18em] text-red-900">
              {siteName}
            </p>

            <p className="mt-4 max-w-md font-mono text-sm leading-7 text-zinc-500">
              {message}
            </p>
          </div>
        </div>
      </div>
    </>
  )
          }
