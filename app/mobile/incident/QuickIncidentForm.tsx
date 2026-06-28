'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { DEFAULT_INCIDENT_FIELD_VISIBILITY, sessionLabel } from '@/lib/visibility'

interface TrackerSession {
  id: string
  session_number?: number | null
  date_start: string
  date_end: string | null
}

interface Props {
  trackerSessions: TrackerSession[]
  activeSessionId: string | null
}

export default function QuickIncidentForm({ trackerSessions, activeSessionId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [people, setPeople] = useState('')
  const [form, setForm] = useState({
    occurred_at: new Date().toISOString().slice(0, 16),
    severity: 5,
    description: '',
    personal_notes: '',
    substance_use: 'no' as 'no' | 'yes' | 'comedown',
    tracker_session_id: activeSessionId,
    police_called: false,
    ambulance_called: false,
  })

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) {
      toast.error('Add a short description.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Login expired.')
      setSaving(false)
      return
    }

    const peopleList = people
      .split(',')
      .map(person => person.trim())
      .filter(Boolean)

    const { error } = await supabase.from('mental_health_incidents').insert({
      occurred_at: form.occurred_at,
      severity: form.severity,
      description: form.description.trim(),
      personal_notes: form.personal_notes.trim(),
      notes: '',
      substance_use: form.substance_use,
      police_called: form.police_called,
      was_arrested: false,
      ambulance_called: form.ambulance_called,
      was_sectioned: false,
      is_sensitive: false,
      tracker_session_id: form.tracker_session_id || null,
      user_id: user.id,
      people_involved: peopleList,
      field_visibility: DEFAULT_INCIDENT_FIELD_VISIBILITY,
    })

    if (error) {
      toast.error('Failed: ' + error.message)
      setSaving(false)
      return
    }

    toast.success('Incident saved.')
    router.push('/mobile')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="rounded-[2rem] border border-red-900/50 bg-red-950/20 p-5">
        <label className="text-[10px] font-mono uppercase tracking-widest text-red-300/70">What happened</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={5}
          placeholder="Quick entry..."
          className="mt-3 w-full resize-none rounded-3xl border border-red-900/40 bg-black px-4 py-4 text-base text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-red-700"
          required
        />
      </section>

      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Severity: {form.severity}/10</label>
        <input
          type="range"
          min={1}
          max={10}
          value={form.severity}
          onChange={e => set('severity', Number(e.target.value))}
          className="mt-4 w-full accent-red-700"
        />
        <div className="mt-1 flex justify-between text-[10px] font-mono text-zinc-700">
          <span>Low</span>
          <span>Crisis</span>
        </div>
      </section>

      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5 space-y-4">
        <Field label="Date & time">
          <input type="datetime-local" value={form.occurred_at} onChange={e => set('occurred_at', e.target.value)} className="phone-input" />
        </Field>

        <Field label="People involved">
          <input value={people} onChange={e => setPeople(e.target.value)} placeholder="Names separated by commas" className="phone-input" />
        </Field>

        <Field label="Substance use">
          <select value={form.substance_use} onChange={e => set('substance_use', e.target.value)} className="phone-input">
            <option value="no">No</option>
            <option value="yes">Yes</option>
            <option value="comedown">Comedown</option>
          </select>
        </Field>

        {trackerSessions.length > 0 && (
          <Field label="Link session">
            <select value={form.tracker_session_id ?? ''} onChange={e => set('tracker_session_id', e.target.value || null)} className="phone-input">
              <option value="">No session</option>
              {trackerSessions.map(session => (
                <option key={session.id} value={session.id}>
                  {sessionLabel(session)} - {formatDate(session.date_start)}{session.date_end ? '' : ' active'}
                </option>
              ))}
            </select>
          </Field>
        )}
      </section>

      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5 space-y-3">
        <label className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black px-4 py-3">
          <span className="text-sm font-mono text-zinc-400">Police called</span>
          <input type="checkbox" checked={form.police_called} onChange={e => set('police_called', e.target.checked)} className="h-5 w-5 accent-red-700" />
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black px-4 py-3">
          <span className="text-sm font-mono text-zinc-400">Ambulance called</span>
          <input type="checkbox" checked={form.ambulance_called} onChange={e => set('ambulance_called', e.target.checked)} className="h-5 w-5 accent-red-700" />
        </label>
      </section>

      <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
        <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Private note</label>
        <textarea
          value={form.personal_notes}
          onChange={e => set('personal_notes', e.target.value)}
          rows={4}
          placeholder="Optional private notes..."
          className="mt-3 w-full resize-none rounded-3xl border border-zinc-800 bg-black px-4 py-4 text-base text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
        />
      </section>

      <button type="submit" disabled={saving} className="w-full rounded-[2rem] border border-red-900/60 bg-red-950 px-5 py-5 text-base font-semibold text-red-100 disabled:opacity-40">
        {saving ? 'Saving...' : 'Save Incident'}
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  )
}
