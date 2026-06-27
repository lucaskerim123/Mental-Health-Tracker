'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { Trash2, Edit2, X, Check, Lock } from 'lucide-react'
import type { MentalHealthIncident } from '@/lib/supabase/types'

interface Props {
  incident: MentalHealthIncident
  isAdmin: boolean
  canViewSensitive: boolean
}

export default function IncidentDetail({ incident, isAdmin, canViewSensitive }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(incident)
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
        names_involved: form.names_involved,
        substance_use: form.substance_use,
        emergency_services: form.emergency_services,
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
        <div className="flex items-center flex-wrap gap-2">
          <span className={`text-sm font-mono px-3 py-1 ${form.severity >= 7 ? 'text-red-700 bg-red-950/40 border border-red-900/40' : form.severity >= 4 ? 'text-amber-700 bg-amber-950/40 border border-amber-900/40' : 'text-zinc-500 bg-zinc-800 border border-zinc-700'}`}>
            SEV {form.severity}
          </span>
          {form.substance_use && form.substance_use !== 'no' && (
            <span className={`text-[10px] font-mono px-2 py-0.5 border border-amber-900/30 uppercase tracking-widest ${substanceColors[form.substance_use]}`}>
              {form.substance_use === 'comedown' ? 'Comedown' : 'Substance Use'}
            </span>
          )}
          {form.emergency_services && (
            <span className="text-[10px] font-mono text-red-600 px-2 py-0.5 border border-red-900/40 uppercase tracking-widest">Emergency Services</span>
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
            <Field label="Names Involved">
              <input type="text" value={form.names_involved ?? ''} onChange={e => set('names_involved', e.target.value)} placeholder="Who was present or involved..." className="vault-input" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Substance Use</label>
                <select value={form.substance_use ?? 'no'} onChange={e => set('substance_use', e.target.value)} className="vault-input">
                  <option value="no">No</option>
                  <option value="yes">Yes — Active use</option>
                  <option value="comedown">Comedown</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Emergency Services</label>
                <label className="flex items-center gap-3 h-10 cursor-pointer">
                  <input type="checkbox" checked={form.emergency_services} onChange={e => set('emergency_services', e.target.checked)} className="accent-red-800 w-4 h-4" />
                  <span className="text-sm font-mono text-zinc-400">Police / Paramedics called</span>
                </label>
              </div>
            </div>
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
            {form.names_involved && <ReadField label="Names Involved" restricted={false}>{form.names_involved}</ReadField>}
            {canViewSensitive && form.personal_notes && <ReadField label="Personal Notes" restricted={false}>{form.personal_notes}</ReadField>}
            {form.notes && <ReadField label="Notes" restricted={isSensitive('notes')}>{form.notes}</ReadField>}
          </>
        )}
      </div>
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
