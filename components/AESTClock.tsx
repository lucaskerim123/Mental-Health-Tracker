'use client'

import { useState, useEffect } from 'react'

export default function AESTClock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      const tz = { timeZone: 'Australia/Sydney' }
      setTime(now.toLocaleTimeString('en-AU', { ...tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      setDate(now.toLocaleDateString('en-AU', { ...tz, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  return (
    <div className="text-right">
      <p className="text-[11px] font-mono text-zinc-300 tabular-nums">{time} <span className="text-zinc-600">AEST</span></p>
      <p className="text-[9px] font-mono text-zinc-600 tracking-wide">{date}</p>
    </div>
  )
}
