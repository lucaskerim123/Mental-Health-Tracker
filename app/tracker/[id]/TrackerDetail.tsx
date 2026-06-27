'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime, daysUp } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, X, Check, StopCircle, Lock } from 'lucide-react'
import type { DrugTrackerSession, SleepLog, DrugUseLog } from '@/lib/supabase/types'

interface LinkedIncident {
  id: string
  occurred_at: string
  severity: number
  description: string
  is_sensitive: boolean
  police_called: boolean
  ambulance_called: boolean
  was_arrested: boolean
  was_sectioned: boolean
}

interface Props {
  session: DrugTrackerSession
  sleepLog: SleepLog[]
  drugUseLog: DrugUseLog[]
  linkedIncidents: LinkedIncident[]
  isAdmin: boolean
  canViewSensitive: boolean
}

export default function TrackerDetail({ session, sleepLog, drugUseLog: initialDrugUseLog, linkedIncidents, isAdmin, canViewSensitive }: Props) {
  const router = useRouter()
  const [s, setS] = useState(session)
  const [editing, setEditing] = useState(false)
  const [sensitiveFields, setSensitiveFields] = useState<string[]>(session.sensitive_fields ?? [])

  // Sleep state
  const [sleepInput, setSleepInput] = useState('')
  const [addingSleep, setAddingSleep] = useState(false)
  const [showSleepInput, setShowSleepInput] = useState(false)

  // Usage state
  const [drugUseLog, setDrugUseLog] = useState<DrugUseLog[]>(initialDrugUseLog)
  const [showUsageInput, setShowUsageInput] = useState(false)
  const [usageForm, setUsageForm] = useState({ substance: '', amount: '', unit: '', notes: '' })
  const [addingUsage, setAddingUsage] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const days = daysUp(s.date_start, s.date_end)
  const isOngoing = !s.date_end

  function toggleSensitiveField(field: string) {
    setSensitiveFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    )
  }

  function isSensitive(field: string) {
    return sensitiveFields.includes(field)
  }

  async function addSleep() {
    const hrs = parseFloat(sleepInput)
    if (isNaN(hrs) || hrs <= 0) { toast.error('Enter a valid number of hours.'); return }
    setAddingSleep(true)
    const supabase = createClient()
    const newTotal = Number(s.sleep_hours) + hrs

    const [{ error: logErr }, { error: sessErr }] = await Promise.all([
      supabase.from('sleep_log').insert({ session_id: s.id, hours_added: hrs }),
      supabase.from('drug_tracker_sessions').update({ sleep_hours: newTotal }).eq('id', s.id),
    ])

    if (logErr || sessErr) { toast.error('Failed to record sleep.') }
    else {
      setS(prev => ({ ...prev, sleep_hours: newTotal }))
      setSleepInput('')
      setShowSleepInput(false)
      toast.success(`+${hrs}h added. Total: ${newTotal}h`)
    }
    setAddingSleep(false)
  }

  async function addUsage() {
    if (!usageForm.substance.trim()) { toast.error('Substance is required.'); return }
    setAddingUsage(true)
    const supabase = createClient()
    const payload = {
      session_id: s.id,
      substance: usageForm.substance.trim(),
      amount: usageForm.amount ? parseFloat(usageForm.amount) : null,
      unit: usageForm.unit.trim() || null,
      notes: usageForm.notes.trim() || null,
    }
    const { data, error } = await supabase.from('drug_use_log').insert(payload).select().single()
    if (error) { toast.error('Failed to log usage.') }
    else {
      setDrugUseLog(prev => [data, ...prev])
      setUsageForm({ substance: '', amount: '', unit: '', notes: '' })
      setShowUsageInput(false)
      toast.success('Usage logged.')
    }
    setAddingUsage(false)
  }

  async function deleteUsageEntry(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('drug_use_log').delete().eq('id', id)
    if (error) { toast.error('Failed to delete.') }
    else { setDrugUseLog(prev => prev.filter(e => e.id !== id)) }
  }

  async function closeSession() {
    if (!confirm('Mark this session as ended today?')) return
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('drug_tracker_sessions').update({ date_end: today }).eq('id', s.id)
    if (error) { toast.error('Failed.') }
    else { setS(prev => ({ ...prev, date_end: today })); toast.success('Session closed.') }
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('drug_tracker_sessions').update({
      any_incidents: s.any_incidents,
      personal_reflection: s.personal_reflection,
      notes: s.notes,
      is_sensitive: s.is_sensitive,
      sensitive_fields: sensitiveFields,
    }).eq('id', s.id)

    if (error) { toast.error('Save failed.') }
    else { toast.success('Saved.'); setEditing(false) }
    setSaving(false)
  }

  async function deleteSession() {
    if (!confirm('Delete this session permanently?')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('drug_tracker_sessions').delete().eq('id', s.id)
    toast.success('Deleted.')
    router.push('/tracker')
  }

  const sevColor = (sev: number) =>
    sev >= 7 ? 'text-red-700 bg-red-950/40 border-red-900/40'
    : sev >= 4 ? 'text-amber-700 bg-amber-950/40 border-amber-900/40'
    : 'text-zinc-500 bg-zinc-800 border-zinc-700'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">Session</h1>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">Started {formatDate(s.date_start)}</p>
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
                {isOngoing && <button onClick={closeSession} className="p-2 text-amber-800 hover:text-amber-600"><StopCircle className="w-4 h-4" /></button>}
                <button onClick={() => setEditing(true)} className="p-2 text-zinc-500 hover:text-zinc-300"><Edit2 className="w-4 h-4" /></button>
                <button onClick={deleteSession} disabled={deleting} className="p-2 text-red-900 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Duration counter */}
      <div className={`border p-4 text-center ${isOngoing ? 'border-amber-900/40 bg-amber-950/10' : 'border-zinc-800 bg-zinc-950'}`}>
        <p className="text-4xl font-mono font-bold text-zinc-200">{days}</p>
        <p className="text-[10px] tracking-[0.4em] uppercase font-mono text-zinc-600 mt-1">
          {isOngoing ? 'Days — Ongoing' : `Days — Ended ${formatDate(s.date_end!)}`}
        </p>
      </div>

      {/* Sleep */}
      <div className="border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">Sleep Recorded</p>
            <p className="text-2xl font-mono text-zinc-200 mt-1">{s.sleep_hours}h</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowSleepInput(v => !v)} className="flex items-center gap-1.5 text-[11px] font-mono text-amber-800 border border-amber-900/40 px-3 py-1.5 hover:bg-amber-950/20 transition-colors">
              <Plus className="w-3 h-3" /> Add Sleep
            </button>
          )}
        </div>
        {showSleepInput && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
            <input type="number" step="0.5" min="0.5" max="24" value={sleepInput} onChange={e => setSleepInput(e.target.value)} placeholder="Hours (e.g. 2.5)" className="vault-input flex-1 text-sm" />
            <button onClick={addSleep} disabled={addingSleep} className="text-[11px] font-mono text-amber-200 bg-amber-950 border border-amber-900/60 px-4 py-2 hover:bg-amber-900 disabled:opacity-40 uppercase tracking-widest">
              {addingSleep ? '...' : 'Add'}
            </button>
          </div>
        )}
        {sleepLog.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1">
            {sleepLog.slice(0, 5).map(log => (
              <div key={log.id} className="flex justify-between text-[10px] font-mono text-zinc-600">
                <span>+{log.hours_added}h</span>
                <span>{formatDateTime(log.logged_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage log */}
      {canViewSensitive && (
        <div className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">Usage Log</p>
            {isAdmin && (
              <button onClick={() => setShowUsageInput(v => !v)} className="flex items-center gap-1.5 text-[11px] font-mono text-red-800 border border-red-900/40 px-3 py-1.5 hover:bg-red-950/20 transition-colors">
                <Plus className="w-3 h-3" /> Log Usage
              </button>
            )}
          </div>

          {showUsageInput && (
            <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 sm:col-span-1 space-y-1">
                  <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Substance</label>
                  <input type="text" value={usageForm.substance} onChange={e => setUsageForm(f => ({ ...f, substance: e.target.value }))} placeholder="e.g. MDMA" className="vault-input text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Amount</label>
                  <input type="number" step="any" min="0" value={usageForm.amount} onChange={e => setUsageForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="vault-input text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Unit</label>
                  <input type="text" value={usageForm.unit} onChange={e => setUsageForm(f => ({ ...f, unit: e.target.value }))} placeholder="g / mg / pills" className="vault-input text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Notes (optional)</label>
                <input type="text" value={usageForm.notes} onChange={e => setUsageForm(f => ({ ...f, notes: e.target.value }))} placeholder="Route, context, etc." className="vault-input text-sm" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={addUsage} disabled={addingUsage} className="text-[11px] font-mono text-red-200 bg-red-950 border border-red-900/60 px-4 py-1.5 hover:bg-red-900 disabled:opacity-40 uppercase tracking-widest">
                  {addingUsage ? '...' : 'Log'}
                </button>
                <button onClick={() => setShowUsageInput(false)} className="text-[11px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-widest">Cancel</button>
              </div>
            </div>
          )}

          {drugUseLog.length > 0 ? (
            <div className="space-y-1.5">
              {drugUseLog.map(entry => (
                <div key={entry.id} className="flex items-start justify-between text-[11px] font-mono border border-zinc-800/60 px-3 py-2">
                  <div>
                    <span className="text-zinc-300">{entry.substance}</span>
                    {(entry.amount != null || entry.unit) && (
                      <span className="text-zinc-500 ml-2">{entry.amount != null ? entry.amount : ''}{entry.unit ? ` ${entry.unit}` : ''}</span>
                    )}
                    {entry.notes && <p className="text-zinc-600 mt-0.5 text-[10px]">{entry.notes}</p>}
                    <p className="text-zinc-700 mt-0.5 text-[10px]">{formatDateTime(entry.logged_at)}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteUsageEntry(entry.id)} className="text-zinc-700 hover:text-red-700 transition-colors ml-3 shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] font-mono text-zinc-700">No usage logged yet.</p>
          )}
        </div>
      )}

      {/* Linked incidents */}
      {linkedIncidents.length > 0 && (
        <div className="border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600 mb-3">
            Linked Incidents <span className="text-zinc-700">({linkedIncidents.length})</span>
          </p>
          <div className="space-y-1.5">
            {linkedIncidents.map(inc => (
              <Link key={inc.id} href={`/incidents/${inc.id}`} className="flex items-center justify-between border border-zinc-800 hover:border-zinc-700 px-3 py-2.5 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[10px] font-mono px-2 py-0.5 border shrink-0 ${sevColor(inc.severity)}`}>
                    SEV {inc.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-zinc-600">{formatDateTime(inc.occurred_at)}</p>
                    <p className="text-xs font-mono text-zinc-400 truncate">
                      {inc.is_sensitive ? '[Sensitive]' : inc.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  {inc.police_called && <span className="text-[9px] font-mono text-red-700 border border-red-900/40 px-1.5 py-0.5 uppercase">Police</span>}
                  {inc.ambulance_called && <span className="text-[9px] font-mono text-orange-700 border border-orange-900/40 px-1.5 py-0.5 uppercase">Amb.</span>}
                  <span className="text-zinc-700 group-hover:text-zinc-500 text-xs">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notes & reflections */}
      <div className="border border-zinc-800 bg-zinc-950 p-5 space-y-5">
        {editing ? (
          <>
            <LockableField label="Any Incidents" field="any_incidents" isSensitive={isSensitive} toggle={toggleSensitiveField} showToggle={isAdmin}>
              <textarea value={s.any_incidents ?? ''} onChange={e => setS(prev => ({ ...prev, any_incidents: e.target.value }))} rows={3} className="vault-input w-full resize-none" />
            </LockableField>

            <div className="space-y-1.5">
              <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Notes <span className="text-zinc-700 normal-case tracking-normal">(public)</span></label>
              <textarea value={s.notes ?? ''} onChange={e => setS(prev => ({ ...prev, notes: e.target.value }))} rows={3} className="vault-input w-full resize-none" />
            </div>

            {canViewSensitive && (
              <div className="space-y-1.5">
                <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">
                  Personal Reflection <span className="text-amber-900 tracking-normal normal-case font-mono text-[9px] border border-amber-900/30 px-1.5 py-0.5">Counsellor only</span>
                </label>
                <textarea value={s.personal_reflection ?? ''} onChange={e => setS(prev => ({ ...prev, personal_reflection: e.target.value }))} rows={6} className="vault-input w-full resize-none" />
              </div>
            )}

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={s.is_sensitive} onChange={e => setS(prev => ({ ...prev, is_sensitive: e.target.checked }))} className="accent-red-800 w-4 h-4" />
              <span className="text-[11px] font-mono text-zinc-500">Mark as sensitive (hides entire session from viewers)</span>
            </label>
          </>
        ) : (
          <>
            {s.any_incidents && <ReadField label="Any Incidents" restricted={isSensitive('any_incidents')}>{s.any_incidents}</ReadField>}
            {s.notes && <ReadField label="Notes" restricted={false}>{s.notes}</ReadField>}
            {canViewSensitive && s.personal_reflection && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Personal Reflection</p>
                  <span className="text-[9px] font-mono text-amber-900/70 tracking-widest uppercase border border-amber-900/20 px-1.5 py-0.5">Counsellor only</span>
                </div>
                <p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{s.personal_reflection}</p>
              </div>
            )}
            {s.is_sensitive && <span className="text-[9px] font-mono text-red-800 tracking-widest uppercase border border-red-900/30 px-2 py-0.5">Sensitive</span>}
          </>
        )}
      </div>
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
            title={locked ? 'Restricted to counsellors+' : 'Click to restrict to counsellors+'}
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
