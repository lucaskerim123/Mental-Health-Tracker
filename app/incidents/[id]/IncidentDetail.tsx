'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { Trash2, Edit2, X, Check, Lock } from 'lucide-react'
import type { FieldVisibilityLevel, IncidentFieldKey, IncidentFieldVisibility, MentalHealthIncident, Role } from '@/lib/supabase/types'
import { incidentLabel, normalizeIncidentVisibility, REDACTED, sessionLabel, visibleIncidentText } from '@/lib/visibility'

interface TrackerSession {
  id: string
  session_number?: number | null
  date_start: string
  date_end: string | null
}

interface Props {
  incident: MentalHealthIncident
  role: Role
  isAdmin: boolean
  trackerSessions: TrackerSession[]
}

export default function IncidentDetail({ incident, role, isAdmin, trackerSessions }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(incident)
  const [people, setPeople] = useState<string[]>(incident.people_involved ?? [])
  const [fieldVisibility, setFieldVisibility] = useState<IncidentFieldVisibility>(normalizeIncidentVisibility(incident.field_visibility))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setVisibility(field: IncidentFieldKey, level: FieldVisibilityLevel) {
    setFieldVisibility(prev => ({ ...prev, [field]: level }))
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('mental_health_incidents')
      .update({
        occurred_at: form.occurred_at,
        severity: form.severity,
        description: form.description,
        location: form.location,
        outcome: form.outcome,
        professional_note: form.professional_note,
        personal_notes: form.personal_notes,
        notes: form.notes,
        substance_use: form.substance_use,
        police_called: form.police_called,
        was_arrested: form.was_arrested,
        ambulance_called: form.ambulance_called,
        was_sectioned: form.was_sectioned,
        people_involved: people,
        tracker_session_id: form.tracker_session_id,
        is_sensitive: form.is_sensitive,
        field_visibility: normalizeIncidentVisibility(fieldVisibility),
      })
      .eq('id', incident.id)

    if (error) toast.error('Save failed: ' + error.message)
    else { toast.success('Saved.'); setEditing(false); router.refresh() }
    setSaving(false)
  }

  async function deleteIncident() {
    if (!confirm('Delete this incident permanently?')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('mental_health_incidents').delete().eq('id', incident.id)
    toast.success('Deleted.')
    router.push('/incidents')
  }

  const linkedSession = trackerSessions.find(s => s.id === form.tracker_session_id)
  const visibility = normalizeIncidentVisibility(fieldVisibility)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">{incidentLabel(incident)}</h1>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{formatDateTime(incident.occurred_at)}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="p-2 text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
                <button onClick={save} disabled={saving} className="p-2 text-green-700 hover:text-green-500"><Check className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="p-2 text-zinc-500 hover:text-zinc-300"><Edit2 className="w-4 h-4" /></button>
                <button onClick={deleteIncident} disabled={deleting} className="p-2 text-red-900 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border border-zinc-800 bg-zinc-950 p-6 space-y-5">
        <div className="flex items-center flex-wrap gap-2">
          <span className={`text-sm font-mono px-3 py-1 ${form.severity >= 7 ? 'text-red-700 bg-red-950/40 border border-red-900/40' : form.severity >= 4 ? 'text-amber-700 bg-amber-950/40 border border-amber-900/40' : 'text-zinc-500 bg-zinc-800 border border-zinc-700'}`}>
            SEV {form.severity}
          </span>
          {form.police_called && <Badge>Police</Badge>}
          {form.was_arrested && <Badge>Arrested</Badge>}
          {form.ambulance_called && <Badge>Ambulance</Badge>}
          {form.was_sectioned && <Badge>Sectioned</Badge>}
          {form.is_sensitive && <span className="text-[9px] font-mono text-red-800 tracking-widest uppercase border border-red-900/30 px-2 py-0.5">Sensitive</span>}
        </div>

        {editing ? (
          <>
            <Field label="Date & Time">
              <input type="datetime-local" value={form.occurred_at.slice(0, 16)} onChange={e => set('occurred_at', e.target.value)} className="vault-input" required />
            </Field>
            <Field label="Severity">
              <input type="range" min={1} max={10} value={form.severity} onChange={e => set('severity', Number(e.target.value))} className="w-full accent-red-800" />
              <span className="text-[10px] font-mono text-zinc-500">{form.severity}/10</span>
            </Field>
            <LockableField label="Incident Details" field="description" visibility={visibility} setVisibility={setVisibility}>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="vault-input resize-none" />
            </LockableField>
            <LockableField label="Location" field="location" visibility={visibility} setVisibility={setVisibility}>
              <input value={form.location ?? ''} onChange={e => set('location', e.target.value)} className="vault-input" />
            </LockableField>
            <LockableField label="Who Was Involved" field="people_involved" visibility={visibility} setVisibility={setVisibility}>
              <TagInput tags={people} onChange={setPeople} />
            </LockableField>
            <Field label="Substance Use">
              <select value={form.substance_use ?? 'no'} onChange={e => set('substance_use', e.target.value)} className="vault-input">
                <option value="no">No</option>
                <option value="yes">Yes - Active use</option>
                <option value="comedown">Comedown</option>
              </select>
            </Field>
            <CheckField label="Police called" checked={form.police_called} onChange={v => set('police_called', v)} />
            {form.police_called && <CheckField label="Was arrested" checked={form.was_arrested} onChange={v => set('was_arrested', v)} />}
            <CheckField label="Ambulance called" checked={form.ambulance_called} onChange={v => set('ambulance_called', v)} />
            {form.ambulance_called && <CheckField label="Was sectioned" checked={form.was_sectioned} onChange={v => set('was_sectioned', v)} />}
            {trackerSessions.length > 0 && (
              <Field label="Linked Session">
                <select value={form.tracker_session_id ?? ''} onChange={e => set('tracker_session_id', e.target.value || null)} className="vault-input">
                  <option value="">None</option>
                  {trackerSessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)} - {formatDate(s.date_start)}</option>)}
                </select>
              </Field>
            )}
            <LockableField label="Notes" field="notes" visibility={visibility} setVisibility={setVisibility}>
              <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={3} className="vault-input resize-none" />
            </LockableField>
            <LockableField label="Private Notes" field="personal_notes" visibility={visibility} setVisibility={setVisibility}>
              <textarea value={form.personal_notes ?? ''} onChange={e => set('personal_notes', e.target.value)} rows={4} className="vault-input resize-none" />
            </LockableField>
            <LockableField label="Note for Counsellor or Lawyer" field="professional_note" visibility={visibility} setVisibility={setVisibility}>
              <textarea value={form.professional_note ?? ''} onChange={e => set('professional_note', e.target.value)} rows={3} className="vault-input resize-none" />
            </LockableField>
            <LockableField label="Outcome" field="outcome" visibility={visibility} setVisibility={setVisibility}>
              <textarea value={form.outcome ?? ''} onChange={e => set('outcome', e.target.value)} rows={2} className="vault-input resize-none" />
            </LockableField>
            <CheckField label="Mark entire entry as sensitive" checked={form.is_sensitive} onChange={v => set('is_sensitive', v)} />
          </>
        ) : (
          <>
            <ReadField label="Incident Details" value={visibleIncidentText(role, form, 'description', form.description)} />
            <ReadField label="Location" value={visibleIncidentText(role, form, 'location', form.location)} />
            {people.length > 0 && <ReadField label="Who Was Involved" value={visibleIncidentText(role, form, 'people_involved', people.join(', '))} />}
            {linkedSession && (
              <div className="space-y-1">
                <p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Linked Session</p>
                <Link href={`/tracker/${linkedSession.id}`} className="text-sm font-mono text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors">
                  {sessionLabel(linkedSession)} - {formatDate(linkedSession.date_start)}
                </Link>
              </div>
            )}
            <ReadField label="Notes" value={visibleIncidentText(role, form, 'notes', form.notes)} />
            <ReadField label="Private Notes" value={visibleIncidentText(role, form, 'personal_notes', form.personal_notes)} />
            <ReadField label="Note for Counsellor or Lawyer" value={visibleIncidentText(role, form, 'professional_note', form.professional_note)} />
            <ReadField label="Outcome" value={visibleIncidentText(role, form, 'outcome', form.outcome)} />
          </>
        )}
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-mono text-red-700 px-2 py-0.5 border border-red-900/40 uppercase tracking-widest">{children}</span>
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-red-800 w-4 h-4" />
      <span className="text-sm font-mono text-zinc-400">{label}</span>
    </label>
  )
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  function add(value: string) {
    const trimmed = value.trim().replace(/,+$/, '').trim()
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput('')
  }
  return (
    <div className="min-h-[2.5rem] flex flex-wrap gap-1.5 items-center border border-zinc-800 bg-black px-2 py-1.5 cursor-text">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="text-zinc-500 hover:text-zinc-200 leading-none"><X className="w-2.5 h-2.5" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) }
          if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1))
        }}
        onBlur={() => input.trim() && add(input)}
        placeholder={tags.length === 0 ? 'Add names - Enter or comma to add...' : ''}
        className="flex-1 min-w-[160px] bg-transparent text-sm font-mono text-zinc-300 focus:outline-none placeholder:text-zinc-700"
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>{children}</div>
}

function LockableField({ label, field, visibility, setVisibility, children }: {
  label: string
  field: IncidentFieldKey
  visibility: Required<IncidentFieldVisibility>
  setVisibility: (field: IncidentFieldKey, level: FieldVisibilityLevel) => void
  children: React.ReactNode
}) {
  const locked = visibility[field] !== 'viewer+'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>
        <div className="flex items-center gap-2">
          <Lock className={`w-3 h-3 ${locked ? 'text-red-700' : 'text-zinc-700'}`} />
          <select value={visibility[field]} onChange={e => setVisibility(field, e.target.value as FieldVisibilityLevel)} className="bg-black border border-zinc-800 text-[10px] font-mono text-zinc-400 px-2 py-1">
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

function ReadField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  const restricted = value === REDACTED
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">{label}</p>
        {restricted && <span className="text-[9px] font-mono text-red-900/70 tracking-widest uppercase">Restricted</span>}
      </div>
      <p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}
