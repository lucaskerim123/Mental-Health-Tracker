'use client'

import { useEffect, useState } from 'react'

export default function CaptureGuard({ enabled }: { enabled: boolean }) {
  const [covered, setCovered] = useState(false)

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove('capture-guard-active', 'capture-guard-hidden')
      return
    }

    document.body.classList.add('capture-guard-active')

    const cover = () => {
      document.body.classList.add('capture-guard-hidden')
      setCovered(true)
    }

    const uncover = () => {
      document.body.classList.remove('capture-guard-hidden')
      setCovered(false)
    }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') cover()
      else window.setTimeout(uncover, 180)
    }

    const onBlur = () => cover()
    const onFocus = () => window.setTimeout(uncover, 180)

    const prevent = (event: Event) => event.preventDefault()
    const preventKeyboard = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && ['c', 'x', 's', 'a', 'p'].includes(key)) event.preventDefault()
      if (key === 'printscreen') {
        cover()
        event.preventDefault()
        window.setTimeout(uncover, 800)
      }
    }

    document.addEventListener('contextmenu', prevent)
    document.addEventListener('copy', prevent)
    document.addEventListener('cut', prevent)
    document.addEventListener('dragstart', prevent)
    document.addEventListener('selectstart', prevent)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('keydown', preventKeyboard)

    return () => {
      document.body.classList.remove('capture-guard-active', 'capture-guard-hidden')
      document.removeEventListener('contextmenu', prevent)
      document.removeEventListener('copy', prevent)
      document.removeEventListener('cut', prevent)
      document.removeEventListener('dragstart', prevent)
      document.removeEventListener('selectstart', prevent)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('keydown', preventKeyboard)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      aria-hidden={!covered}
      className={`capture-guard-overlay pointer-events-none fixed inset-0 z-[9999] bg-black transition-opacity duration-150 ${covered ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}
