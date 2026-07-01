'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Lock, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { sessionLabel } from '@/lib/sessions'
import { DEFAULT_INCIDENT_FIELD_VISIBILITY } from '@/lib/incidents'
import PermissionSelector from '@/components/permissions/PermissionSelector'
import type { FieldVisibilityLevel, IncidentFieldKey, IncidentFieldVisibility } from '@/lib/supabase/types'

interface TrackerSession { id: string; session_number: number | null; date_start: string; date_end: string | null }
interface Props { trackerSessions: TrackerSession[] }

export default function NewIncidentForm({ trackerSessions }: Props) {
  const router = useRouter()
  const activeSessionId = trackerSessions.find(session => !session.date_end)?.id ?? null
  const [form, setForm] = useState({ occurred_at: new Date().toISOString().slice(0, 16), severity: 5, brief_summary: '', description: '', location: '', personal_notes: '', notes: '', professional_note: '', outcome: '', substance_use: 'no' as 'no' | 'yes' | 'comedown', police_called: false, was_arrested: false, ambulance_called: false, was_sectioned: false, is_sensitive: false, tracker_session_id: activeSessionId as string | null })
  const [people, setPeople] = useState<string[]>([])
  const [fieldVisibility, setFieldVisibility] = useState<Record<IncidentFieldKey, FieldVisibilityLevel>>({ ...DEFAULT_INCIDENT_FIELD_VISIBILITY })
  const [saving, setSaving] = useState(false)

  function set(field: string, value: unknown) { setForm(prev => ({ ...prev, [field]: value })) }
  function setVisibility(field: IncidentFieldKey, value: FieldVisibilityLevel) { setFieldVisibility(prev => ({ ...prev, [field]: value })) }

  function isMissingBriefSummaryColumnError(error: { code?: string | null; message?: string | null } | null) {
    const message = error?.message?.toLowerCase() ?? ''
    return error?.code === '42703' || message.includes('brief_summary') && message.includes('column')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Login expired.'); setSaving(false); return }
    const sensitiveFields = Object.entries(fieldVisibility).filter(([, value]) => value !== 'viewer+').map(([field]) => field)
    const basePayload = { occurred_at: form.occurred_at, severity: form.severity, description: form.description.trim(), location: form.location.trim() || null, personal_notes: form.personal_notes.trim() || null, notes: form.notes.trim() || null, professional_note: form.professional_note.trim() || null, outcome: form.outcome.trim() || null, substance_use: form.substance_use, police_called: form.police_called, was_arrested: form.police_called ? form.was_arrested : false, ambulance_called: form.ambulance_called, was_sectioned: form.ambulance_called ? form.was_sectioned : false, is_sensitive: form.is_sensitive, tracker_session_id: form.tracker_session_id, user_id: user.id, people_involved: people, sensitive_fields: sensitiveFields, field_visibility: fieldVisibility satisfies IncidentFieldVisibility }
    const withSummary = { ...basePayload, brief_summary: form.brief_summary.trim() || null }
    let result = await supabase.from('mental_health_incidents').insert(withSummary).select().single()
    if (result.error && isMissingBriefSummaryColumnError(result.error)) {
      result = await supabase.from('mental_health_incidents').insert(basePayload).select().single()
    }
    if (result.error) { toast.error('Failed to save: ' + result.error.message); setSaving(false); return }
    toast.success('Incident recorded.')
    router.push(`/incidents/${result.data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Date & Time"><input type="datetime-local" value={form.occurred_at} onChange={e => set('occurred_at', e.target.value)} className="vault-input" required /></Field>
      <Field label={`Severity: ${form.severity}/10`}><input type="range" min={1} max={10} value={form.severity} onChange={e => set('severity', Number(e.target.value))} className="w-full accent-red-800" /><div className="flex justify-between text-[10px] text-zinc-600 font-mono"><span>1 minimal</span><span>10 crisis</span></div></Field>
      <LockableField label="Brief Summary" field="brief_summary" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.brief_summary} onChange={e => set('brief_summary', e.target.value)} rows={2} className="vault-input resize-none" placeholder="Short front-card safe summary" /></LockableField>
      <LockableField label="Incident Details" field="description" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="vault-input resize-none" required /></LockableField>
      <LockableField label="Location" field="location" visibility={fieldVisibility} setVisibility={setVisibility}><input value={form.location} onChange={e => set('location', e.target.value)} className="vault-input" /></LockableField>
      <LockableField label="Who was involved" field="people_involved" visibility={fieldVisibility} setVisibility={setVisibility}><TagInput tags={people} onChange={setPeople} /></LockableField>
      <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Substance Use</label><select value={form.substance_use} onChange={e => set('substance_use', e.target.value)} className="vault-input"><option value="no">No</option><option value="yes">Yes - Active use</option><option value="comedown">Comedown</option></select></div>
      <div className="space-y-2"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Emergency Services</label><div className="space-y-2 border border-zinc-800 bg-zinc-950 p-3"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.police_called} onChange={e => set('police_called', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-sm font-mono text-zinc-400">Police called</span></label>{form.police_called && <div className="ml-7 border-l border-zinc-800 pl-3"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.was_arrested} onChange={e => set('was_arrested', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-sm font-mono text-zinc-500">Was arrested</span></label></div>}<label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.ambulance_called} onChange={e => set('ambulance_called', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-sm font-mono text-zinc-400">Ambulance called</span></label>{form.ambulance_called && <div className="ml-7 border-l border-zinc-800 pl-3"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.was_sectioned} onChange={e => set('was_sectioned', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-sm font-mono text-zinc-500">Was sectioned</span></label></div>}</div></div>
      {trackerSessions.length > 0 && <Field label="Link to Tracker Session"><select value={form.tracker_session_id ?? ''} onChange={e => set('tracker_session_id', e.target.value || null)} className="vault-input"><option value="">None</option>{trackerSessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)} - {formatDate(s.date_start)}{s.date_end ? ` -> ${formatDate(s.date_end)}` : ' (ongoing)'}</option>)}</select></Field>}
      <LockableField label="Private Notes" field="personal_notes" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.personal_notes} onChange={e => set('personal_notes', e.target.value)} rows={4} placeholder="Private reflections" className="vault-input resize-none" /></LockableField>
      <LockableField label="General Notes" field="notes" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="vault-input resize-none" /></LockableField>
      <LockableField label="Note for counsellor and lawyer" field="professional_note" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.professional_note} onChange={e => set('professional_note', e.target.value)} rows={3} className="vault-input resize-none" /></LockableField>
      <LockableField label="What's outcome" field="outcome" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.outcome} onChange={e => set('outcome', e.target.value)} rows={3} className="vault-input resize-none" /></LockableField>
      <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.is_sensitive} onChange={e => set('is_sensitive', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-[11px] font-mono text-zinc-500 tracking-wide">Mark entire entry as sensitive (hides from viewers)</span></label>
      <div className="flex gap-3 pt-2"><button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-zinc-500 border border-zinc-800 hover:border-zinc-700 uppercase transition-colors">Cancel</button><button type="submit" disabled={saving} className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-red-200 bg-red-950 border border-red-900/60 hover:bg-red-900 uppercase transition-colors disabled:opacity-40">{saving ? 'Saving...' : 'Record Incident'}</button></div>
    </form>
  )
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  function add(value: string) { const trimmed = value.trim().replace(/,+$/, '').trim(); if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]); setInput('') }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === 'Enter') { e.preventDefault(); add(input) }; if (e.key === ',') { e.preventDefault(); add(input) }; if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1)) }
  return <div className="min-h-[2.5rem] flex flex-wrap gap-1.5 items-center border border-zinc-800 bg-black px-2 py-1.5 cursor-text">{tags.map(tag => <span key={tag} className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5">{tag}<button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="text-zinc-500 hover:text-zinc-200 leading-none"><X className="w-2.5 h-2.5" /></button></span>)}<input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} onBlur={() => input.trim() && add(input)} placeholder={tags.length === 0 ? 'Add names - Enter or comma to add...' : ''} className="flex-1 min-w-[160px] bg-transparent text-sm font-mono text-zinc-300 focus:outline-none placeholder:text-zinc-700" /></div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>{children}</div> }
function LockableField({ label, field, visibility, setVisibility, children }: { label: string; field: IncidentFieldKey; visibility: Record<IncidentFieldKey, FieldVisibilityLevel>; setVisibility: (field: IncidentFieldKey, value: FieldVisibilityLevel) => void; children: React.ReactNode }) {
  const locked = visibility[field] !== 'viewer+'
  return <div className="space-y-1.5"><div className="flex items-center justify-between gap-3"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label><div className="flex items-center gap-2"><PermissionSelector label="" value={visibility[field]} onChange={value => setVisibility(field, value)} /><Lock className={`w-3 h-3 ${locked ? 'text-red-700' : 'text-zinc-700'}`} /></div></div>{children}</div>
}
