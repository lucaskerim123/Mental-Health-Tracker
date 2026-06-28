'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Lock, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  DEFAULT_INCIDENT_FIELD_VISIBILITY,
  INCIDENT_VISIBILITY_FIELDS,
  normalizeIncidentVisibility,
} from '@/lib/visibility'
import type { FieldVisibilityLevel, IncidentFieldKey, IncidentFieldVisibility } from '@/lib/supabase/types'

interface TrackerSession {
  id: string
  session_number?: number | null
  date_start: string
  date_end: string | null
}

interface Props {
  trackerSessions: TrackerSession[]
}

export default function NewIncidentForm({ trackerSessions }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    occurred_at: new Date().toISOString().slice(0, 16),
    severity: 5,
    description: '',
    location: '',
    outcome: '',
    professional_note: '',
    personal_notes: '',
    notes: '',
    substance_use: 'no' as 'no' | 'yes' | 'comedown',
    police_called: false,
    was_arrested: false,
    ambulance_called: false,
    was_sectioned: false,
    is_sensitive: false,
    tracker_session_id: null as string | null,
  })
  const [people, setPeople] = useState<string[]>([])
  const [fieldVisibility, setFieldVisibility] = useState<IncidentFieldVisibility>(DEFAULT_INCIDENT_FIELD_VISIBILITY)
  const [saving, setSaving] = useState(false)

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setVisibility(field: IncidentFieldKey, level: FieldVisibilityLevel) {
    setFieldVisibility(prev => ({ ...prev, [field]: level }))
  }

  function visibilityFor(field: IncidentFieldKey) {
    return normalizeIncidentVisibility(fieldVisibility)[field]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error, data } = await supabase.from('mental_health_incidents').insert({
      ...form,
      user_id: user!.id,
      people_involved: people,
      field_visibility: normalizeIncidentVisibility(fieldVisibility),
    }).select().single()

    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    toast.success('Incident recorded.')
    router.push(`/incidents/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Date & Time">
        <input type="datetime-local" value={form.occurred_at} onChange={e => set('occurred_at', e.target.value)} className="vault-input" required />
      </Field>

      <Field label={`Severity: ${form.severity}/10`}>
        <input type="range" min={1} max={10} value={form.severity} onChange={e => set('severity', Number(e.target.value))} className="w-full accent-red-800" />
        <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
          <span>1 minimal</span><span>10 crisis</span>
        </div>
      </Field>

      <LockableField label="Incident Details" field="description" visibilityFor={visibilityFor} setVisibility={setVisibility}>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="vault-input resize-none" required />
      </LockableField>

      <LockableField label="Location" field="location" visibilityFor={visibilityFor} setVisibility={setVisibility}>
        <input value={form.location} onChange={e => set('location', e.target.value)} className="vault-input" />
      </LockableField>

      <LockableField label="Who Was Involved" field="people_involved" visibilityFor={visibilityFor} setVisibility={setVisibility}>
        <TagInput tags={people} onChange={setPeople} />
      </LockableField>

      <Field label="Substance Use">
        <select value={form.substance_use} onChange={e => set('substance_use', e.target.value)} className="vault-input">
          <option value="no">No</option>
          <option value="yes">Yes - Active use</option>
          <option value="comedown">Comedown</option>
        </select>
      </Field>

      <div className="space-y-2">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Emergency Services</label>
        <div className="space-y-2 border border-zinc-800 bg-zinc-950 p-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.police_called} onChange={e => set('police_called', e.target.checked)} className="accent-red-800 w-4 h-4" />
            <span className="text-sm font-mono text-zinc-400">Police called</span>
          </label>
          {form.police_called && (
            <div className="ml-7 border-l border-zinc-800 pl-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.was_arrested} onChange={e => set('was_arrested', e.target.checked)} className="accent-red-800 w-4 h-4" />
                <span className="text-sm font-mono text-zinc-500">Was arrested</span>
              </label>
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.ambulance_called} onChange={e => set('ambulance_called', e.target.checked)} className="accent-red-800 w-4 h-4" />
            <span className="text-sm font-mono text-zinc-400">Ambulance called</span>
          </label>
          {form.ambulance_called && (
            <div className="ml-7 border-l border-zinc-800 pl-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.was_sectioned} onChange={e => set('was_sectioned', e.target.checked)} className="accent-red-800 w-4 h-4" />
                <span className="text-sm font-mono text-zinc-500">Was sectioned</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {trackerSessions.length > 0 && (
        <Field label="Link to Session">
          <select value={form.tracker_session_id ?? ''} onChange={e => set('tracker_session_id', e.target.value || null)} className="vault-input">
            <option value="">None</option>
            {trackerSessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.session_number ? `Session #${s.session_number}` : formatDate(s.date_start)}{s.date_end ? ` - ${formatDate(s.date_end)}` : ' (ongoing)'}
              </option>
            ))}
          </select>
        </Field>
      )}

      <LockableField label="Notes" field="notes" visibilityFor={visibilityFor} setVisibility={setVisibility}>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="vault-input resize-none" />
      </LockableField>

      <LockableField label="Private Notes" field="personal_notes" visibilityFor={visibilityFor} setVisibility={setVisibility}>
        <textarea value={form.personal_notes} onChange={e => set('personal_notes', e.target.value)} rows={4} className="vault-input resize-none" />
      </LockableField>

      <LockableField label="Note for Counsellor or Lawyer" field="professional_note" visibilityFor={visibilityFor} setVisibility={setVisibility}>
        <textarea value={form.professional_note} onChange={e => set('professional_note', e.target.value)} rows={3} className="vault-input resize-none" />
      </LockableField>

      <LockableField label="Outcome" field="outcome" visibilityFor={visibilityFor} setVisibility={setVisibility}>
        <textarea value={form.outcome} onChange={e => set('outcome', e.target.value)} rows={2} className="vault-input resize-none" />
      </LockableField>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.is_sensitive} onChange={e => set('is_sensitive', e.target.checked)} className="accent-red-800 w-4 h-4" />
        <span className="text-[11px] font-mono text-zinc-500 tracking-wide">Mark entire entry as sensitive</span>
      </label>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-zinc-500 border border-zinc-800 hover:border-zinc-700 uppercase transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-red-200 bg-red-950 border border-red-900/60 hover:bg-red-900 uppercase transition-colors disabled:opacity-40">
          {saving ? 'Saving...' : 'Record Incident'}
        </button>
      </div>
    </form>
  )
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')

  function add(value: string) {
    const trimmed = value.trim().replace(/,+$/, '').trim()
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); add(input) }
    if (e.key === ',') { e.preventDefault(); add(input) }
    if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1))
  }

  return (
    <div className="min-h-[2.5rem] flex flex-wrap gap-1.5 items-center border border-zinc-800 bg-black px-2 py-1.5 cursor-text">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="text-zinc-500 hover:text-zinc-200 leading-none">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => input.trim() && add(input)}
        placeholder={tags.length === 0 ? 'Add names - Enter or comma to add...' : ''}
        className="flex-1 min-w-[160px] bg-transparent text-sm font-mono text-zinc-300 focus:outline-none placeholder:text-zinc-700"
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>
      {children}
    </div>
  )
}

function LockableField({ label, field, visibilityFor, setVisibility, children }: {
  label: string
  field: IncidentFieldKey
  visibilityFor: (f: IncidentFieldKey) => FieldVisibilityLevel
  setVisibility: (f: IncidentFieldKey, level: FieldVisibilityLevel) => void
  children: React.ReactNode
}) {
  const visibility = visibilityFor(field)
  const locked = visibility !== 'viewer+'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>
        <div className="flex items-center gap-2">
          <Lock className={`w-3 h-3 ${locked ? 'text-red-700' : 'text-zinc-700'}`} />
          <select value={visibility} onChange={e => setVisibility(field, e.target.value as FieldVisibilityLevel)} className="bg-black border border-zinc-800 text-[10px] font-mono text-zinc-400 px-2 py-1">
            {INCIDENT_VISIBILITY_FIELDS.map(() => null)[0]}
            <option value="viewer+">viewer+</option>
            <option value="counsellor+">counsellor+</option>
            <option value="lawyer+">lawyer+</option>
            <option value="admin only">admin only</option>
          </select>
        </div>
      </div>
      {children}
    </div>
  )
}
