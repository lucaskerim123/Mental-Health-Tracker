'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000
const LAST_ACTIVITY_KEY = 'mht:last-activity-at'
const LOGOUT_EVENT_KEY = 'mht:force-logout-at'
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'mousedown', 'touchstart', 'scroll', 'visibilitychange'] as const

export default function InactivityLogout() {
  const router = useRouter()
  const pathname = usePathname()
  const timeoutRef = useRef<number | null>(null)
  const loggingOutRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    function isAuthRoute() {
      return pathname?.startsWith('/login') || pathname?.startsWith('/mobile/login') || pathname?.startsWith('/join')
    }

    function clearTimer() {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    async function forceLogout() {
      if (loggingOutRef.current) return
      loggingOutRef.current = true
      clearTimer()
      localStorage.setItem(LOGOUT_EVENT_KEY, Date.now().toString())
      localStorage.removeItem(LAST_ACTIVITY_KEY)
      await supabase.auth.signOut()
      router.replace(isAuthRoute() ? '/login' : `/login?next=${encodeURIComponent(pathname || '/dashboard')}`)
      router.refresh()
    }

    function scheduleLogout() {
      clearTimer()
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now())
      const timeLeft = Math.max(0, INACTIVITY_LIMIT_MS - (Date.now() - lastActivity))
      timeoutRef.current = window.setTimeout(forceLogout, timeLeft)
    }

    function markActivity() {
      if (loggingOutRef.current || isAuthRoute()) return
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
      scheduleLogout()
    }

    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || isAuthRoute()) {
        clearTimer()
        return
      }

      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now())
      localStorage.setItem(LAST_ACTIVITY_KEY, lastActivity.toString())

      if (Date.now() - lastActivity >= INACTIVITY_LIMIT_MS) {
        await forceLogout()
        return
      }

      scheduleLogout()
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === LOGOUT_EVENT_KEY && event.newValue) forceLogout()
    }

    checkExistingSession()
    ACTIVITY_EVENTS.forEach(eventName => window.addEventListener(eventName, markActivity, { passive: true }))
    window.addEventListener('storage', handleStorage)

    return () => {
      clearTimer()
      ACTIVITY_EVENTS.forEach(eventName => window.removeEventListener(eventName, markActivity))
      window.removeEventListener('storage', handleStorage)
    }
  }, [pathname, router])

  return null
}
