'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { Trash2, Edit2, X, Check, Lock } from 'lucide-react'
import type { MentalHealthIncident } from '@/lib/supabase/types'

interface TrackerSession {
  id: string
  date_start: string
  date_end: string | null
}

interface Props {
  incident: MentalHealthIncident
  isAdmin: boolean
  canViewSensitive: boolean
  trackerSessions: TrackerSession[]
}

export default function IncidentDetail({ incident, isAdmin, canViewSensitive, trackerSessions }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(incident)
  const [people, setPeople] = useState<string[]>(incident.people_involved ?? [])
  const [sensitiveFields, setSensitiveFields] = useState<string[]>(incident.sensitive_fields ?? [])
  const substanceColors = { no: 'text-zinc-500', yes: 'text-amber-600', comedown: 'text-orange-600' } as const
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleSensitiveField(field: string) {
    setSensitiveFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    )
  }

  function isSensitive(field: string) {
    return sensitiveFields.includes(field)
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
        sensitive_fields: sensitiveFields,
      })
      .eq('id', incident.id)

    if (error) { toast.error('Save failed: ' + error.message) }
    else { toast.success('Saved.'); setEditing(false) }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">Incident</h1>
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
        {/* Status badges */}
        <div className="flex items-center flex-wrap gap-2">
          <span className={`text-sm font-mono px-3 py-1 ${form.severity >= 7 ? 'text-red-700 bg-red-950/40 border border-red-900/40' : form.severity >= 4 ? 'text-amber-700 bg-amber-950/40 border border-amber-900/40' : 'text-zinc-500 bg-zinc-800 border border-zinc-700'}`}>
            SEV {form.severity}
          </span>
          {form.substance_use && form.substance_use !== 'no' && (
            <span className={`text-[10px] font-mono px-2 py-0.5 border border-amber-900/30 uppercase tracking-widest ${substanceColors[form.substance_use]}`}>
              {form.substance_use === 'comedown' ? 'Comedown' : 'Substance Use'}
            </span>
          )}
          {form.police_called && (
            <span className="text-[10px] font-mono text-red-600 px-2 py-0.5 border border-red-900/40 uppercase tracking-widest">Police</span>
          )}
          {form.was_arrested && (
            <span className="text-[10px] font-mono text-red-700 px-2 py-0.5 border border-red-900/50 bg-red-950/20 uppercase tracking-widest">Arrested</span>
          )}
          {form.ambulance_called && (
            <span className="text-[10px] font-mono text-orange-600 px-2 py-0.5 border border-orange-900/40 uppercase tracking-widest">Ambulance</span>
          )}
          {form.was_sectioned && (
            <span className="text-[10px] font-mono text-orange-700 px-2 py-0.5 border border-orange-900/50 bg-orange-950/20 uppercase tracking-widest">Sectioned</span>
          )}
          {form.is_sensitive && <span className="text-[9px] font-mono text-red-800 tracking-widest uppercase border border-red-900/30 px-2 py-0.5">Sensitive</span>}
        </div>

        {editing ? (
          <>
            <Field label="Severity">
              <input type="range" min={1} max={10} value={form.severity} onChange={e => set('severity', Number(e.target.value))} className="w-full accent-red-800" />
              <span className="text-[10px] font-mono text-zinc-500">{form.severity}/10</span>
            </Field>

            <LockableField label="Description" field="description" isSensitive={isSensitive} toggle={toggleSensitiveField} showToggle={isAdmin}>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="vault-input resize-none" />
            </LockableField>

            <Field label="People Involved">
              <TagInput tags={people} onChange={setPeople} />
            </Field>

            <div className="space-y-1.5">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Substance Use</label>
              <select value={form.substance_use ?? 'no'} onChange={e => set('substance_use', e.target.value)} className="vault-input">
                <option value="no">No</option>
                <option value="yes">Yes — Active use</option>
                <option value="comedown">Comedown</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Emergency Services</label>
              <div className="space-y-2 border border-zinc-800 bg-zinc-900/30 p-3">
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
              <Field label="Link to Tracker Session">
                <select value={form.tracker_session_id ?? ''} onChange={e => set('tracker_session_id', e.target.value || null)} className="vault-input">
                  <option value="">— None —</option>
                  {trackerSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {formatDate(s.date_start)}{s.date_end ? ` → ${formatDate(s.date_end)}` : ' (ongoing)'}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {canViewSensitive && (
              <Field label="Personal Notes (always restricted)">
                <textarea value={form.personal_notes ?? ''} onChange={e => set('personal_notes', e.target.value)} rows={4} className="vault-input resize-none" />
              </Field>
            )}

            <LockableField label="Notes" field="notes" isSensitive={isSensitive} toggle={toggleSensitiveField} showToggle={isAdmin}>
              <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={3} className="vault-input resize-none" />
            </LockableField>

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={form.is_sensitive} onChange={e => set('is_sensitive', e.target.checked)} className="accent-red-800 w-4 h-4" />
              <span className="text-[11px] font-mono text-zinc-500">Mark entire entry as sensitive (hides from viewers)</span>
            </label>
          </>
        ) : (
          <>
            <ReadField label="Description" restricted={isSensitive('description')}>{form.description}</ReadField>

            {people.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">People Involved</p>
                <div className="flex flex-wrap gap-1.5">
                  {people.map(p => (
                    <span key={p} className="text-[11px] font-mono text-zinc-300 bg-zinc-800 border border-zinc-700 px-2 py-0.5">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {(form.police_called || form.ambulance_called) && (
              <div className="space-y-1">
                <p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Emergency Services</p>
                <div className="space-y-1 font-mono text-sm">
                  {form.police_called && (
                    <p className="text-zinc-400">
                      Police called
                      {form.was_arrested && <span className="ml-2 text-[10px] text-red-700 uppercase tracking-widest border border-red-900/40 px-1.5 py-0.5">Arrested</span>}
                    </p>
                  )}
                  {form.ambulance_called && (
                    <p className="text-zinc-400">
                      Ambulance called
                      {form.was_sectioned && <span className="ml-2 text-[10px] text-orange-700 uppercase tracking-widest border border-orange-900/40 px-1.5 py-0.5">Sectioned</span>}
                    </p>
                  )}
                </div>
              </div>
            )}

            {linkedSession && (
              <div className="space-y-1">
                <p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Linked Tracker Session</p>
                <Link href={`/tracker/${linkedSession.id}`} className="text-sm font-mono text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors">
                  {formatDate(linkedSession.date_start)}{linkedSession.date_end ? ` → ${formatDate(linkedSession.date_end)}` : ' (ongoing)'}
                </Link>
              </div>
            )}

            {canViewSensitive && form.personal_notes && <ReadField label="Personal Notes" restricted={false}>{form.personal_notes}</ReadField>}
            {form.notes && <ReadField label="Notes" restricted={isSensitive('notes')}>{form.notes}</ReadField>}
          </>
        )}
      </div>
    </div>
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
        placeholder={tags.length === 0 ? 'Add names — Enter or comma to add...' : ''}
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

function LockableField({ label, field, isSensitive, toggle, showToggle, children }: {
  label: string; field: string; isSensitive: (f: string) => boolean; toggle: (f: string) => void; showToggle: boolean; children: React.ReactNode
}) {
  const locked = isSensitive(field)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>
        {showToggle && (
          <button type="button" onClick={() => toggle(field)}
            title={locked ? 'Restricted to counsellors+ — click to unrestrict' : 'Click to restrict to counsellors+'}
            className={`p-0.5 transition-colors ${locked ? 'text-red-700' : 'text-zinc-700 hover:text-zinc-500'}`}>
            <Lock className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function ReadField({ label, restricted, children }: { label: string; restricted: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">{label}</p>
        {restricted && <span className="text-[9px] font-mono text-red-900/70 tracking-widest uppercase">Restricted</span>}
      </div>
      <p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{children}</p>
    </div>
  )
}
