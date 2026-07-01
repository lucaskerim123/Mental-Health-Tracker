'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils'
import { sessionLabel } from '@/lib/sessions'
import { toast } from 'sonner'
import { Trash2, Edit2, X, Check, Lock } from 'lucide-react'
import PermissionSelector from '@/components/permissions/PermissionSelector'
import RedactedText from '@/components/permissions/RedactedText'
import type { Document, FieldVisibilityLevel, IncidentFieldKey, MentalHealthIncident, Role } from '@/lib/supabase/types'
import {
  REDACTED,
  canViewIncidentField,
  incidentLabel,
  normalizeIncidentVisibility,
  visibleIncidentList,
  visibleIncidentText,
} from '@/lib/incidents'

interface TrackerSession { id: string; session_number: number | null; date_start: string; date_end: string | null }
interface Props { incident: MentalHealthIncident; role: Role; isAdmin: boolean; trackerSessions: TrackerSession[]; documents: Document[]; userId: string }

export default function IncidentDetail({ incident, role, isAdmin, trackerSessions, documents, userId }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(incident)
  const [people, setPeople] = useState<string[]>(incident.people_involved ?? [])
  const [fieldVisibility, setFieldVisibility] = useState<Record<IncidentFieldKey, FieldVisibilityLevel>>(normalizeIncidentVisibility(incident.field_visibility, incident.sensitive_fields))
  const substanceColors = { no: 'text-zinc-500', yes: 'text-amber-600', comedown: 'text-orange-600' } as const
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const attachedDocuments = documents.filter(doc => doc.attached_to_type === 'incident' && doc.attached_to_id === incident.id)

  function set(field: string, value: unknown) { setForm(prev => ({ ...prev, [field]: value })) }
  function setVisibility(field: IncidentFieldKey, value: FieldVisibilityLevel) { setFieldVisibility(prev => ({ ...prev, [field]: value })) }

  function isMissingBriefSummaryColumnError(error: { code?: string | null; message?: string | null } | null) {
    const message = error?.message?.toLowerCase() ?? ''
    return error?.code === '42703' || message.includes('brief_summary') && message.includes('column')
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const sensitiveFields = Object.entries(fieldVisibility).filter(([, value]) => value !== 'viewer+').map(([field]) => field)
    const basePayload = { occurred_at: form.occurred_at, severity: form.severity, description: form.description, location: form.location, personal_notes: form.personal_notes, notes: form.notes, professional_note: form.professional_note, outcome: form.outcome, substance_use: form.substance_use, police_called: form.police_called, was_arrested: form.police_called ? form.was_arrested : false, ambulance_called: form.ambulance_called, was_sectioned: form.ambulance_called ? form.was_sectioned : false, people_involved: people, tracker_session_id: form.tracker_session_id, is_sensitive: form.is_sensitive, sensitive_fields: sensitiveFields, field_visibility: fieldVisibility }
    const withSummary = { ...basePayload, brief_summary: form.brief_summary }
    let result = await supabase.from('mental_health_incidents').update(withSummary).eq('id', incident.id).select().single()
    if (result.error && isMissingBriefSummaryColumnError(result.error)) {
      result = await supabase.from('mental_health_incidents').update(basePayload).eq('id', incident.id).select().single()
    }
    if (result.error) toast.error('Save failed: ' + result.error.message)
    else { toast.success('Saved.'); setForm(prev => ({ ...prev, ...(result.data ?? {}), field_visibility: fieldVisibility, sensitive_fields: sensitiveFields, people_involved: people })); setEditing(false); router.refresh() }
    setSaving(false)
  }

  async function deleteIncident() { if (!confirm('Delete this incident permanently?')) return; setDeleting(true); const supabase = createClient(); await supabase.from('mental_health_incidents').delete().eq('id', incident.id); toast.success('Deleted.'); router.push('/incidents') }

  const linkedSession = trackerSessions.find(s => s.id === form.tracker_session_id)
  const visibilityIncident = { ...form, field_visibility: fieldVisibility, sensitive_fields: form.sensitive_fields ?? [] }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">{incidentLabel(form)}</h1><p className="text-[10px] text-zinc-600 font-mono mt-0.5">{formatDateTime(form.occurred_at)}</p></div>
        {isAdmin && <div className="flex items-center gap-2">{editing ? <><button onClick={() => setEditing(false)} className="p-2 text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button><button onClick={save} disabled={saving} className="p-2 text-green-700 hover:text-green-500"><Check className="w-4 h-4" /></button></> : <><button onClick={() => setEditing(true)} className="p-2 text-zinc-500 hover:text-zinc-300"><Edit2 className="w-4 h-4" /></button><button onClick={deleteIncident} disabled={deleting} className="p-2 text-red-900 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></>}</div>}
      </div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href={`/incidents/${incident.id}/report`} className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 transition-colors">
          Export / Print
        </Link>
      </div>
      <div className="border border-zinc-800 bg-zinc-950 p-6 space-y-5">
        <div className="flex items-center flex-wrap gap-2"><span className={`text-sm font-mono px-3 py-1 ${form.severity >= 7 ? 'text-red-700 bg-red-950/40 border border-red-900/40' : form.severity >= 4 ? 'text-amber-700 bg-amber-950/40 border border-amber-900/40' : 'text-zinc-500 bg-zinc-800 border border-zinc-700'}`}>SEV {form.severity}</span>{form.substance_use && form.substance_use !== 'no' && <span className={`text-[10px] font-mono px-2 py-0.5 border border-amber-900/30 uppercase tracking-widest ${substanceColors[form.substance_use]}`}>{form.substance_use === 'comedown' ? 'Comedown' : 'Substance Use'}</span>}{form.police_called && <span className="text-[10px] font-mono text-red-600 px-2 py-0.5 border border-red-900/40 uppercase tracking-widest">Police</span>}{form.was_arrested && <span className="text-[10px] font-mono text-red-700 px-2 py-0.5 border border-red-900/50 bg-red-950/20 uppercase tracking-widest">Arrested</span>}{form.ambulance_called && <span className="text-[10px] font-mono text-orange-600 px-2 py-0.5 border border-orange-900/40 uppercase tracking-widest">Ambulance</span>}{form.was_sectioned && <span className="text-[10px] font-mono text-orange-700 px-2 py-0.5 border border-orange-900/50 bg-orange-950/20 uppercase tracking-widest">Sectioned</span>}{form.is_sensitive && <span className="text-[9px] font-mono text-red-800 tracking-widest uppercase border border-red-900/30 px-2 py-0.5">Sensitive</span>}</div>
        {editing ? <>
          <Field label="Date & Time"><input type="datetime-local" value={form.occurred_at.slice(0, 16)} onChange={e => set('occurred_at', e.target.value)} className="vault-input" required /></Field>
          <Field label="Severity"><input type="range" min={1} max={10} value={form.severity} onChange={e => set('severity', Number(e.target.value))} className="w-full accent-red-800" /><span className="text-[10px] font-mono text-zinc-500">{form.severity}/10</span></Field>
          <LockableField label="Brief Summary" field="brief_summary" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.brief_summary ?? ''} onChange={e => set('brief_summary', e.target.value)} rows={2} className="vault-input resize-none" placeholder="Short front-card safe summary" /></LockableField>
          <LockableField label="Incident Details" field="description" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="vault-input resize-none" /></LockableField>
          <LockableField label="Location" field="location" visibility={fieldVisibility} setVisibility={setVisibility}><input value={form.location ?? ''} onChange={e => set('location', e.target.value)} className="vault-input" /></LockableField>
          <LockableField label="Who was involved" field="people_involved" visibility={fieldVisibility} setVisibility={setVisibility}><TagInput tags={people} onChange={setPeople} /></LockableField>
          <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Substance Use</label><select value={form.substance_use ?? 'no'} onChange={e => set('substance_use', e.target.value)} className="vault-input"><option value="no">No</option><option value="yes">Yes - Active use</option><option value="comedown">Comedown</option></select></div>
          <div className="space-y-2"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Emergency Services</label><div className="space-y-2 border border-zinc-800 bg-zinc-900/30 p-3"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.police_called} onChange={e => set('police_called', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-sm font-mono text-zinc-400">Police called</span></label>{form.police_called && <div className="ml-7 border-l border-zinc-800 pl-3"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.was_arrested} onChange={e => set('was_arrested', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-sm font-mono text-zinc-500">Was arrested</span></label></div>}<label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.ambulance_called} onChange={e => set('ambulance_called', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-sm font-mono text-zinc-400">Ambulance called</span></label>{form.ambulance_called && <div className="ml-7 border-l border-zinc-800 pl-3"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.was_sectioned} onChange={e => set('was_sectioned', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-sm font-mono text-zinc-500">Was sectioned</span></label></div>}</div></div>
          {trackerSessions.length > 0 && <Field label="Link to Tracker Session"><select value={form.tracker_session_id ?? ''} onChange={e => set('tracker_session_id', e.target.value || null)} className="vault-input"><option value="">None</option>{trackerSessions.map(s => <option key={s.id} value={s.id}>{sessionLabel(s)} - {formatDate(s.date_start)}{s.date_end ? ` -> ${formatDate(s.date_end)}` : ' (ongoing)'}</option>)}</select></Field>}
          <DocumentsBlock documents={attachedDocuments} role={role} userId={userId} />
          <LockableField label="Private Notes" field="personal_notes" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.personal_notes ?? ''} onChange={e => set('personal_notes', e.target.value)} rows={4} className="vault-input resize-none" /></LockableField>
          <LockableField label="Notes" field="notes" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={3} className="vault-input resize-none" /></LockableField>
          <LockableField label="Note for counsellor and lawyer" field="professional_note" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.professional_note ?? ''} onChange={e => set('professional_note', e.target.value)} rows={3} className="vault-input resize-none" /></LockableField>
          <LockableField label="What's outcome" field="outcome" visibility={fieldVisibility} setVisibility={setVisibility}><textarea value={form.outcome ?? ''} onChange={e => set('outcome', e.target.value)} rows={3} className="vault-input resize-none" /></LockableField>
          <label className="flex items-center gap-3"><input type="checkbox" checked={form.is_sensitive} onChange={e => set('is_sensitive', e.target.checked)} className="accent-red-800 w-4 h-4" /><span className="text-[11px] font-mono text-zinc-500">Mark entire entry as sensitive (hides from viewers)</span></label>
        </> : <>
          <DisplayText label="Brief Summary" value={visibleIncidentText(role, visibilityIncident, 'brief_summary', form.brief_summary)} restricted={!canViewIncidentField(role, visibilityIncident, 'brief_summary')} />
          <DisplayText label="Incident details" value={visibleIncidentText(role, visibilityIncident, 'description', form.description)} restricted={!canViewIncidentField(role, visibilityIncident, 'description')} />
          <DisplayText label="Location" value={visibleIncidentText(role, visibilityIncident, 'location', form.location)} restricted={!canViewIncidentField(role, visibilityIncident, 'location')} />
          <DisplayPeople role={role} incident={visibilityIncident} people={people} />
          {(form.police_called || form.ambulance_called) && <div className="space-y-1"><p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Emergency Services</p><div className="space-y-1 font-mono text-sm">{form.police_called && <p className="text-zinc-400">Police called{form.was_arrested && <span className="ml-2 text-[10px] text-red-700 uppercase tracking-widest border border-red-900/40 px-1.5 py-0.5">Arrested</span>}</p>}{form.ambulance_called && <p className="text-zinc-400">Ambulance called{form.was_sectioned && <span className="ml-2 text-[10px] text-orange-700 uppercase tracking-widest border border-orange-900/40 px-1.5 py-0.5">Sectioned</span>}</p>}</div></div>}
          {linkedSession && <div className="space-y-1"><p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Linked Tracker Session</p><Link href={`/tracker/${linkedSession.id}`} className="text-sm font-mono text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors">{sessionLabel(linkedSession)} - {formatDate(linkedSession.date_start)}{linkedSession.date_end ? ` -> ${formatDate(linkedSession.date_end)}` : ' (ongoing)'}</Link></div>}
          <DisplayText label="Notes" value={visibleIncidentText(role, visibilityIncident, 'notes', form.notes)} restricted={!canViewIncidentField(role, visibilityIncident, 'notes')} />
          <DisplayText label="Private Notes" value={visibleIncidentText(role, visibilityIncident, 'personal_notes', form.personal_notes)} restricted={!canViewIncidentField(role, visibilityIncident, 'personal_notes')} />
          <DisplayText label="Note for counsellor and lawyer" value={visibleIncidentText(role, visibilityIncident, 'professional_note', form.professional_note)} restricted={!canViewIncidentField(role, visibilityIncident, 'professional_note')} />
          <DisplayText label="What's outcome" value={visibleIncidentText(role, visibilityIncident, 'outcome', form.outcome)} restricted={!canViewIncidentField(role, visibilityIncident, 'outcome')} />
        </>}
      </div>
    </div>
  )
}

function DisplayPeople({ role, incident, people }: { role: Role; incident: MentalHealthIncident; people: string[] }) { const visible = visibleIncidentList(role, incident, 'people_involved', people); if (!visible) return null; const restricted = visible === REDACTED; return <div className="space-y-1"><div className="flex items-center gap-2"><p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Who was involved</p>{restricted && <span className="text-[9px] font-mono text-red-900/70 tracking-widest uppercase">Restricted</span>}</div>{restricted ? <RedactedText /> : <div className="flex flex-wrap gap-1.5">{visible.map(p => <span key={p} className="text-[11px] font-mono text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5">{p}</span>)}</div>}</div> }
function DisplayText({ label, value, restricted }: { label: string; value: string | null; restricted: boolean }) { if (!value) return null; return <ReadField label={label} restricted={restricted}>{value === REDACTED ? <RedactedText /> : value}</ReadField> }
function DocumentsBlock({ documents, role, userId }: { documents: Document[]; role: Role; userId: string }) {
  if (!documents.length) return null
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Attached Documents</p>
      <div className="space-y-1.5">
        {documents.map((doc, index) => canViewDocument(doc, role, userId) ? <DocumentRow key={doc.id} doc={doc} index={index + 1} /> : <div key={doc.id} className="border border-zinc-800 bg-zinc-900/30 p-3"><p className="text-sm font-mono text-zinc-400 break-words [overflow-wrap:anywhere]">Document #{index + 1}: REDACTED</p></div>)}
      </div>
    </div>
  )
}
function DocumentRow({ doc, index }: { doc: Document; index: number }) { return <div className="border border-zinc-800 bg-zinc-900/30 p-3"><p className="text-sm font-mono text-zinc-300 break-words [overflow-wrap:anywhere]">Document #{index}: {doc.filename}</p><p className="text-[10px] font-mono text-zinc-600 mt-1 break-words [overflow-wrap:anywhere]">{formatDate(doc.created_at)}{doc.is_sensitive ? ' - Sensitive' : ''}</p></div> }
function canViewDocument(doc: Document, role: Role, userId: string) { return role === 'admin' || (!doc.is_sensitive && (!doc.allowed_user_ids.length || doc.allowed_user_ids.includes(userId))) }
function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) { const [input, setInput] = useState(''); function add(value: string) { const trimmed = value.trim().replace(/,+$/, '').trim(); if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]); setInput('') } function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) { if (e.key === 'Enter') { e.preventDefault(); add(input) }; if (e.key === ',') { e.preventDefault(); add(input) }; if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1)) } return <div className="min-h-[2.5rem] flex flex-wrap gap-1.5 items-center border border-zinc-800 bg-black px-2 py-1.5 cursor-text">{tags.map(tag => <span key={tag} className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5">{tag}<button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="text-zinc-500 hover:text-zinc-200 leading-none"><X className="w-2.5 h-2.5" /></button></span>)}<input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} onBlur={() => input.trim() && add(input)} placeholder={tags.length === 0 ? 'Add names - Enter or comma to add...' : ''} className="flex-1 min-w-[160px] bg-transparent text-sm font-mono text-zinc-300 focus:outline-none placeholder:text-zinc-700" /></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>{children}</div> }
function LockableField({ label, field, visibility, setVisibility, children }: { label: string; field: IncidentFieldKey; visibility: Record<IncidentFieldKey, FieldVisibilityLevel>; setVisibility: (field: IncidentFieldKey, value: FieldVisibilityLevel) => void; children: React.ReactNode }) { const locked = visibility[field] !== 'viewer+'; return <div className="space-y-1.5"><div className="flex items-center justify-between gap-3"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label><div className="flex items-center gap-2"><PermissionSelector label="" value={visibility[field]} onChange={value => setVisibility(field, value)} /><Lock className={`w-3 h-3 ${locked ? 'text-red-700' : 'text-zinc-700'}`} /></div></div>{children}</div> }
function ReadField({ label, restricted, children }: { label: string; restricted: boolean; children: React.ReactNode }) { return <div className="space-y-1"><div className="flex items-center gap-2"><p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">{label}</p>{restricted && <span className="text-[9px] font-mono text-red-900/70 tracking-widest uppercase">Restricted</span>}</div><div className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{children}</div></div> }
