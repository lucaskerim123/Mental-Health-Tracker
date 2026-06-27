'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { daysUp, formatDate } from '@/lib/utils'

interface Session {
  id: string
  date_start: string
  date_end: string | null
  sleep_hours: number
  any_incidents?: string | null
  notes?: string | null
}

interface Props {
  activeSession: Session | null
  recentSessions: Session[]
}

export default function QuickSessionPanel({ activeSession, recentSessions }: Props) {
  const router = useRouter()
  const [sleep, setSleep] = useState('')
  const [note, setNote] = useState(activeSession?.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function startSession() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Login expired.')
      setSaving(false)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('drug_tracker_sessions').insert({
      user_id: user.id,
      date_start: today,
      any_incidents: '',
      personal_reflection: '',
      notes: 'Started from phone app.',
      is_sensitive: false,
      sleep_hours: 0,
      sensitive_fields: [],
    })

    if (error) toast.error('Failed: ' + error.message)
    else {
      toast.success('Session started.')
      router.refresh()
    }
    setSaving(false)
  }

  async function closeSession() {
    if (!activeSession) return
    if (!confirm('Close current session?')) return
    setSaving(true)
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('drug_tracker_sessions').update({ date_end: today }).eq('id', activeSession.id)
    if (error) toast.error('Failed: ' + error.message)
    else {
      toast.success('Session closed.')
      router.refresh()
    }
    setSaving(false)
  }

  async function addSleep() {
    if (!activeSession) return
    const hrs = Number.parseFloat(sleep)
    if (Number.isNaN(hrs) || hrs <= 0) {
      toast.error('Enter sleep hours.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const newTotal = Number(activeSession.sleep_hours) + hrs
    const [{ error: logErr }, { error: sessionErr }] = await Promise.all([
      supabase.from('sleep_log').insert({ session_id: activeSession.id, hours_added: hrs }),
      supabase.from('drug_tracker_sessions').update({ sleep_hours: newTotal }).eq('id', activeSession.id),
    ])

    if (logErr || sessionErr) toast.error('Failed to add sleep.')
    else {
      toast.success(`+${hrs}h sleep saved.`)
      setSleep('')
      router.refresh()
    }
    setSaving(false)
  }

  async function saveNote() {
    if (!activeSession) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('drug_tracker_sessions').update({ notes }).eq('id', activeSession.id)
    if (error) toast.error('Failed: ' + error.message)
    else {
      toast.success('Note saved.')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-amber-900/50 bg-amber-950/20 p-5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-amber-300/70">Current session</p>
        {activeSession ? (
          <>
            <p className="mt-3 text-6xl font-semibold tracking-tight text-zinc-100">Day {daysUp(activeSession.date_start)}</p>
            <p className="mt-2 text-xs font-mono text-zinc-500">Started {formatDate(activeSession.date_start)} · {activeSession.sleep_hours}h sleep</p>
            <button type="button" onClick={closeSession} disabled={saving} className="mt-5 w-full rounded-[1.5rem] border border-zinc-700 bg-black px-4 py-4 text-sm font-semibold text-zinc-200 disabled:opacity-40">
              Close Session
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-2xl font-semibold text-zinc-100">No active session</p>
            <p className="mt-2 text-xs font-mono text-zinc-600">Start tracking from the phone app.</p>
            <button type="button" onClick={startSession} disabled={saving} className="mt-5 w-full rounded-[1.5rem] border border-amber-900/60 bg-amber-950 px-4 py-5 text-base font-semibold text-amber-100 disabled:opacity-40">
              {saving ? 'Starting...' : 'Start Session'}
            </button>
          </>
        )}
      </section>

      {activeSession && (
        <>
          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Add sleep</label>
            <div className="mt-3 flex gap-2">
              <input value={sleep} onChange={e => setSleep(e.target.value)} inputMode="decimal" placeholder="Hours" className="phone-input" />
              <button type="button" onClick={addSleep} disabled={saving} className="rounded-2xl border border-amber-900/60 bg-amber-950 px-5 text-sm font-semibold text-amber-100 disabled:opacity-40">
                Add
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
            <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Session note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={5} placeholder="Quick session note..." className="mt-3 w-full resize-none rounded-3xl border border-zinc-800 bg-black px-4 py-4 text-base text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-zinc-600" />
            <button type="button" onClick={saveNote} disabled={saving} className="mt-3 w-full rounded-[1.5rem] border border-zinc-700 bg-black px-4 py-4 text-sm font-semibold text-zinc-200 disabled:opacity-40">
              Save Note
            </button>
          </section>
        </>
      )}

      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-zinc-600">Recent sessions</p>
        <div className="space-y-2">
          {recentSessions.length ? recentSessions.map(session => (
            <Link key={session.id} href={`/tracker/${session.id}`} className="block rounded-2xl border border-zinc-800 bg-black px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-zinc-500">{formatDate(session.date_start)}</span>
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-mono text-zinc-400">{session.date_end ? 'Closed' : 'Open'}</span>
              </div>
              <p className="mt-1 text-xs font-mono text-zinc-400">{session.sleep_hours}h sleep · Day {daysUp(session.date_start, session.date_end)}</p>
            </Link>
          )) : (
            <p className="py-3 text-center text-xs font-mono text-zinc-700">No sessions yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
