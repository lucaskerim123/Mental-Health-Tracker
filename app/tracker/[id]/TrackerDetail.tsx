'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime, daysUp } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, X, Check, StopCircle, Lock } from 'lucide-react'
import type { DrugTrackerSession, SleepLog, DrugUseLog, TrackerEntry, IncidentFieldVisibility, Role } from '@/lib/supabase/types'
import { incidentLabel, visibleIncidentText } from '@/lib/incidents'
import {
  canViewSessionField,
  isRestrictedSessionField,
  normalizeSessionVisibility,
  sessionLabel,
  visibleSessionText,
} from '@/lib/sessions'

interface LinkedIncident {
  id: string
  incident_number: number | null
  occurred_at: string
  severity: number
  description: string
  is_sensitive: boolean
  sensitive_fields: string[]
  field_visibility: IncidentFieldVisibility | null
  police_called: boolean
  ambulance_called: boolean
  was_arrested: boolean
  was_sectioned: boolean
}

interface SessionEvent {
  id: string
  session_id: string
  event_type?: string
  title?: string
  content?: string | null
  entry_type?: string
  occurred_at: string
}

interface SessionMood {
  id: string
  session_id: string
  mood: string
  notes?: string | null
  occurred_at: string
}

interface SessionNote {
  id: string
  session_id: string
  note?: string
  content?: string
  entry_type?: string
  source?: string
  visibility?: string
  occurred_at: string
}

interface Props {
  session: DrugTrackerSession
  sleepLog: SleepLog[]
  drugUseLog: DrugUseLog[]
  linkedIncidents: LinkedIncident[]
  availableIncidents: LinkedIncident[]
  entries: TrackerEntry[]
  sessionEvents: SessionEvent[]
  sessionMoods: SessionMood[]
  sessionNotes: SessionNote[]
  role: Role
  isAdmin: boolean
  canViewSensitive: boolean
}

export default function TrackerDetail({ session, sleepLog, drugUseLog: initialDrugUseLog, linkedIncidents: initialLinkedIncidents, availableIncidents: initialAvailableIncidents, entries: initialEntries, sessionEvents, sessionMoods: initialSessionMoods, sessionNotes: initialSessionNotes, role, isAdmin, canViewSensitive }: Props) {
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
  const [usageForm, setUsageForm] = useState({ substance: 'ice', amount: '', unit: '', notes: '' })
  const [addingUsage, setAddingUsage] = useState(false)

  const [sessionMoods, setSessionMoods] = useState<SessionMood[]>(initialSessionMoods)
  const [showMoodInput, setShowMoodInput] = useState(false)
  const [moodForm, setMoodForm] = useState({ mood: '', notes: '' })
  const [addingMood, setAddingMood] = useState(false)

  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>(initialSessionNotes)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  const [linkedIncidents, setLinkedIncidents] = useState<LinkedIncident[]>(initialLinkedIncidents)
  const [availableIncidents, setAvailableIncidents] = useState<LinkedIncident[]>(initialAvailableIncidents)
  const [selectedIncidentId, setSelectedIncidentId] = useState('')
  const [linkingIncident, setLinkingIncident] = useState(false)

  // Entries state
  const [entries, setEntries] = useState<TrackerEntry[]>(initialEntries)
  const [showEntryInput, setShowEntryInput] = useState(false)
  const [entryContent, setEntryContent] = useState('')
  const [addingEntry, setAddingEntry] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const days = daysUp(s.date_start, s.date_end)
  const isOngoing = !s.date_end
  const fieldVisibility = normalizeSessionVisibility(s.field_visibility)
  const totalDaysLabel = `Day ${days}`
  const lastSleep = sleepLog[0] ?? null
  const lastSleepAt = lastSleep ? new Date(lastSleep.logged_at) : null
  const lastSleepHoursAgo = lastSleepAt ? Math.max(0, Math.floor((Date.now() - lastSleepAt.getTime()) / (1000 * 60 * 60))) : null

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
      setUsageForm({ substance: 'ice', amount: '', unit: '', notes: '' })
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

  async function addEntry() {
    if (!entryContent.trim()) { toast.error('Entry cannot be empty.'); return }
    setAddingEntry(true)
    const supabase = createClient()
    let { data, error } = await supabase.from('tracker_entries').insert({
      session_id: s.id,
      content: entryContent.trim(),
      source: 'ui',
      entry_type: 'note',
      visibility: fieldVisibility.mcp_outputs,
    }).select().single()
    if (error) {
      const fallback = await supabase.from('tracker_entries').insert({
        session_id: s.id,
        content: entryContent.trim(),
        source: 'ui',
      }).select().single()
      data = fallback.data
      error = fallback.error
    }
    if (error) { toast.error('Failed to add entry.') }
    else {
      setEntries(prev => [data, ...prev])
      setEntryContent('')
      setShowEntryInput(false)
      toast.success('Entry added.')
    }
    setAddingEntry(false)
  }

  async function addMood() {
    if (!moodForm.mood.trim()) { toast.error('Mood cannot be empty.'); return }
    setAddingMood(true)
    const supabase = createClient()
    let { data, error } = await supabase.from('session_moods').insert({
      session_id: s.id,
      mood: moodForm.mood.trim(),
      notes: moodForm.notes.trim() || null,
      source: 'app',
    }).select().single()

    if (error) {
      const content = moodForm.notes.trim() ? `${moodForm.mood.trim()} - ${moodForm.notes.trim()}` : moodForm.mood.trim()
      const fallback = await supabase.from('tracker_entries').insert({
        session_id: s.id,
        content: `Mood: ${content}`,
        source: 'ui',
      }).select().single()
      if (!fallback.error && fallback.data) {
        setEntries(prev => [fallback.data, ...prev])
        data = { id: fallback.data.id, session_id: s.id, mood: moodForm.mood.trim(), notes: moodForm.notes.trim() || null, occurred_at: fallback.data.created_at }
        error = null
      }
    }

    if (error) toast.error('Failed to add mood.')
    else {
      setSessionMoods(prev => [data, ...prev])
      setMoodForm({ mood: '', notes: '' })
      setShowMoodInput(false)
      toast.success('Mood added.')
    }
    setAddingMood(false)
  }

  async function addNote() {
    if (!noteContent.trim()) { toast.error('Note cannot be empty.'); return }
    setAddingNote(true)
    const supabase = createClient()
    let { data, error } = await supabase.from('session_notes').insert({
      session_id: s.id,
      content: noteContent.trim(),
      source: 'app',
      entry_type: 'note',
      visibility: fieldVisibility.notes,
    }).select().single()

    if (error) {
      const fallback = await supabase.from('tracker_entries').insert({
        session_id: s.id,
        content: noteContent.trim(),
        source: 'ui',
      }).select().single()
      if (!fallback.error && fallback.data) {
        setEntries(prev => [fallback.data, ...prev])
        data = { id: fallback.data.id, session_id: s.id, content: fallback.data.content, source: fallback.data.source, occurred_at: fallback.data.created_at }
        error = null
      }
    }

    if (error) toast.error('Failed to add note.')
    else {
      setSessionNotes(prev => [data, ...prev])
      setNoteContent('')
      setShowNoteInput(false)
      toast.success('Note added.')
    }
    setAddingNote(false)
  }

  async function linkIncident() {
    if (!selectedIncidentId) return
    setLinkingIncident(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('mental_health_incidents')
      .update({ tracker_session_id: s.id })
      .eq('id', selectedIncidentId)

    if (error) toast.error('Failed to link incident.')
    else {
      const incident = availableIncidents.find(i => i.id === selectedIncidentId)
      if (incident) {
        setLinkedIncidents(prev => [incident, ...prev])
        setAvailableIncidents(prev => prev.filter(i => i.id !== selectedIncidentId))
      }
      setSelectedIncidentId('')
      toast.success('Incident linked.')
    }
    setLinkingIncident(false)
  }

  async function deleteEntry(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('tracker_entries').delete().eq('id', id)
    if (error) { toast.error('Failed to delete.') }
    else { setEntries(prev => prev.filter(e => e.id !== id)) }
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
    const updatePayload = {
      any_incidents: s.any_incidents,
      brief_notes: s.brief_notes,
      counsellor_notes: s.counsellor_notes,
      lawyer_notes: s.lawyer_notes,
      field_visibility: fieldVisibility,
      personal_reflection: s.personal_reflection,
      notes: s.notes,
      is_sensitive: s.is_sensitive,
      sensitive_fields: sensitiveFields,
    }
    let { error } = await supabase.from('drug_tracker_sessions').update(updatePayload).eq('id', s.id)
    if (error) {
      const fallbackPayload = {
        any_incidents: s.any_incidents,
        personal_reflection: s.personal_reflection,
        notes: s.notes,
        is_sensitive: s.is_sensitive,
        sensitive_fields: sensitiveFields,
      }
      const fallback = await supabase.from('drug_tracker_sessions').update(fallbackPayload).eq('id', s.id)
      error = fallback.error
    }

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
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">{sessionLabel(s)}</h1>
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Started" value={formatDate(s.date_start)} />
        <Metric label="Ended" value={s.date_end ? formatDate(s.date_end) : 'Open'} />
        <Metric label="Total days" value={totalDaysLabel} />
        <Metric label="Incidents" value={`${linkedIncidents.length}`} />
      </div>

      {/* Sleep */}
      <div className="border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">Sleep Recorded</p>
            <p className="text-2xl font-mono text-zinc-200 mt-1">{s.sleep_hours}h</p>
            <p className="text-[10px] font-mono text-zinc-700 mt-1">
              {lastSleepHoursAgo == null ? 'No sleep entries yet' : `Last sleep entry ${lastSleepHoursAgo}h ago`}
            </p>
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
      {(drugUseLog.length > 0 || showUsageInput || isAdmin) && (
        <div className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">Usage Log</p>
            {isAdmin && (
              <button onClick={() => setShowUsageInput(v => !v)} className="flex items-center gap-1.5 text-[11px] font-mono text-red-800 border border-red-900/40 px-3 py-1.5 hover:bg-red-950/20 transition-colors">
                <Plus className="w-3 h-3" /> Log Usage
              </button>
            )}
          </div>

          {!canViewSessionField(role, s, 'usage_log') && drugUseLog.length > 0 ? (
            <p className="text-sm font-mono text-zinc-400">Usage log: REDACTED</p>
          ) : showUsageInput && (
            <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3 sm:col-span-1 space-y-1">
                  <label className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">Substance</label>
                  <input type="text" value={usageForm.substance} onChange={e => setUsageForm(f => ({ ...f, substance: e.target.value }))} placeholder="ice" className="vault-input text-sm" />
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

          {canViewSessionField(role, s, 'usage_log') && drugUseLog.length > 0 ? (
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
          ) : canViewSessionField(role, s, 'usage_log') ? (
            <p className="text-[11px] font-mono text-zinc-700">No usage logged yet.</p>
          ) : null}
        </div>
      )}

      {/* Log entires (outputs from mcp) */}
      {(entries.length > 0 || showEntryInput || isAdmin) && (
        <div className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">Log entires (outputs from mcp)</p>
            {isAdmin && (
              <button onClick={() => setShowEntryInput(v => !v)} className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 border border-zinc-700 px-3 py-1.5 hover:bg-zinc-800 transition-colors">
                <Plus className="w-3 h-3" /> Add Entry
              </button>
            )}
          </div>

          {!canViewSessionField(role, s, 'mcp_outputs') && entries.length > 0 ? (
            <p className="text-sm font-mono text-zinc-400">Log entires (outputs from mcp): REDACTED</p>
          ) : showEntryInput && (
            <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">
              <textarea
                value={entryContent}
                onChange={e => setEntryContent(e.target.value)}
                rows={4}
                placeholder="Write an entry…"
                className="vault-input w-full resize-none text-sm"
              />
              <div className="flex items-center gap-2">
                <button onClick={addEntry} disabled={addingEntry} className="text-[11px] font-mono text-zinc-200 bg-zinc-800 border border-zinc-600 px-4 py-1.5 hover:bg-zinc-700 disabled:opacity-40 uppercase tracking-widest">
                  {addingEntry ? '...' : 'Save'}
                </button>
                <button onClick={() => { setShowEntryInput(false); setEntryContent('') }} className="text-[11px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-widest">Cancel</button>
              </div>
            </div>
          )}

          {canViewSessionField(role, s, 'mcp_outputs') && entries.length > 0 ? (
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="border border-zinc-800/60 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed flex-1">{entry.content}</p>
                    {isAdmin && (
                      <button onClick={() => deleteEntry(entry.id)} className="text-zinc-700 hover:text-red-700 transition-colors shrink-0 mt-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-[10px] font-mono text-zinc-700">{formatDateTime(entry.created_at)}</p>
                    {entry.entry_type && (
                      <span className="text-[9px] font-mono text-zinc-700 border border-zinc-800 px-1.5 py-0.5 uppercase tracking-widest">{entry.entry_type}</span>
                    )}
                    {entry.source === 'mcp' && (
                      <span className="text-[9px] font-mono text-zinc-700 border border-zinc-800 px-1.5 py-0.5 uppercase tracking-widest">via AI</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : canViewSessionField(role, s, 'mcp_outputs') ? (
            <p className="text-[11px] font-mono text-zinc-700">No entries yet.</p>
          ) : null}
        </div>
      )}

      {/* Mood log */}
      {(sessionMoods.length > 0 || showMoodInput || isAdmin) && (
        <div className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">
              Mood / Feeling Entries <span className="text-zinc-700">({sessionMoods.length})</span>
            </p>
            {isAdmin && (
              <button onClick={() => setShowMoodInput(v => !v)} className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 border border-zinc-700 px-3 py-1.5 hover:bg-zinc-800 transition-colors">
                <Plus className="w-3 h-3" /> Add Mood
              </button>
            )}
          </div>
          {showMoodInput && (
            <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">
              <input value={moodForm.mood} onChange={e => setMoodForm(f => ({ ...f, mood: e.target.value }))} placeholder="Mood / feeling" className="vault-input text-sm" />
              <input value={moodForm.notes} onChange={e => setMoodForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note" className="vault-input text-sm" />
              <div className="flex items-center gap-2">
                <button onClick={addMood} disabled={addingMood} className="text-[11px] font-mono text-zinc-200 bg-zinc-800 border border-zinc-600 px-4 py-1.5 hover:bg-zinc-700 disabled:opacity-40 uppercase tracking-widest">
                  {addingMood ? '...' : 'Save'}
                </button>
                <button onClick={() => setShowMoodInput(false)} className="text-[11px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-widest">Cancel</button>
              </div>
            </div>
          )}
          {sessionMoods.length > 0 && (
            <div className="space-y-1.5">
              {sessionMoods.map(m => (
                <div key={m.id} className="border border-zinc-800/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-mono text-zinc-300">{m.mood}</span>
                    <span className="text-[10px] font-mono text-zinc-700">{formatDateTime(m.occurred_at)}</span>
                  </div>
                  {m.notes && <p className="mt-1 text-[10px] font-mono text-zinc-600">{m.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session notes */}
      {(sessionNotes.length > 0 || showNoteInput || isAdmin) && (
        <div className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">
              Notes <span className="text-zinc-700">({sessionNotes.length})</span>
            </p>
            {isAdmin && (
              <button onClick={() => setShowNoteInput(v => !v)} className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 border border-zinc-700 px-3 py-1.5 hover:bg-zinc-800 transition-colors">
                <Plus className="w-3 h-3" /> Add Note
              </button>
            )}
          </div>
          {!canViewSessionField(role, s, 'notes') && sessionNotes.length > 0 ? (
            <p className="text-sm font-mono text-zinc-400">Notes: REDACTED</p>
          ) : (
            <>
              {showNoteInput && (
                <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">
                  <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={4} placeholder="Write a note..." className="vault-input w-full resize-none text-sm" />
                  <div className="flex items-center gap-2">
                    <button onClick={addNote} disabled={addingNote} className="text-[11px] font-mono text-zinc-200 bg-zinc-800 border border-zinc-600 px-4 py-1.5 hover:bg-zinc-700 disabled:opacity-40 uppercase tracking-widest">
                      {addingNote ? '...' : 'Save'}
                    </button>
                    <button onClick={() => { setShowNoteInput(false); setNoteContent('') }} className="text-[11px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-widest">Cancel</button>
                  </div>
                </div>
              )}
              {sessionNotes.length > 0 && (
                <div className="space-y-2">
                  {sessionNotes.map(n => (
                    <div key={n.id} className="border border-zinc-800/60 px-3 py-2.5">
                      <p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{n.content ?? n.note}</p>
                      <p className="text-[10px] font-mono text-zinc-700 mt-1">{formatDateTime(n.occurred_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Session events */}
      {sessionEvents.length > 0 && (
        <div className="border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600 mb-3">Session Events</p>
          <div className="space-y-1">
            {sessionEvents.map(e => (
              <div key={e.id} className="flex items-center justify-between border border-zinc-800/60 px-3 py-2">
                <span className="text-[10px] font-mono text-zinc-500">[{e.event_type}]</span>
                <span className="text-[10px] font-mono text-zinc-700">{formatDateTime(e.occurred_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked incidents */}
      {(linkedIncidents.length > 0 || isAdmin) && (
        <div className="border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">
              Connected Incidents <span className="text-zinc-700">({linkedIncidents.length})</span>
            </p>
          </div>
          {isAdmin && availableIncidents.length > 0 && (
            <div className="mb-3 flex gap-2 border border-zinc-800 bg-zinc-900/30 p-3">
              <select value={selectedIncidentId} onChange={e => setSelectedIncidentId(e.target.value)} className="vault-input flex-1 text-sm">
                <option value="">Link existing incident...</option>
                {availableIncidents.map(incident => (
                  <option key={incident.id} value={incident.id}>
                    {incidentLabel(incident)} - {formatDateTime(incident.occurred_at)}
                  </option>
                ))}
              </select>
              <button onClick={linkIncident} disabled={!selectedIncidentId || linkingIncident} className="text-[11px] font-mono text-amber-200 bg-amber-950 border border-amber-900/60 px-4 py-2 hover:bg-amber-900 disabled:opacity-40 uppercase tracking-widest">
                Link
              </button>
            </div>
          )}
          {linkedIncidents.length > 0 && (
          <div className="space-y-1.5">
            {linkedIncidents.map(inc => (
              <Link key={inc.id} href={`/incidents/${inc.id}`} className="flex items-center justify-between border border-zinc-800 hover:border-zinc-700 px-3 py-2.5 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[10px] font-mono px-2 py-0.5 border shrink-0 ${sevColor(inc.severity)}`}>
                    SEV {inc.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-zinc-600">{incidentLabel(inc)} - {formatDateTime(inc.occurred_at)}</p>
                    <p className="text-xs font-mono text-zinc-400 truncate">
                      {visibleIncidentText(role, inc, 'description', inc.description)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  {inc.police_called && <span className="text-[9px] font-mono text-red-700 border border-red-900/40 px-1.5 py-0.5 uppercase">Police</span>}
                  {inc.ambulance_called && <span className="text-[9px] font-mono text-orange-700 border border-orange-900/40 px-1.5 py-0.5 uppercase">Amb.</span>}
                  <span className="text-zinc-700 group-hover:text-zinc-500 text-xs">-&gt;</span>
                </div>
              </Link>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Notes & reflections */}
      <div className="border border-zinc-800 bg-zinc-950 p-5 space-y-5">
        {editing ? (
          <>
            <TextAreaField label="Brief notes" value={s.brief_notes ?? ''} onChange={value => setS(prev => ({ ...prev, brief_notes: value }))} rows={3} />

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
                  Private Notes <span className="text-amber-900 tracking-normal normal-case font-mono text-[9px] border border-amber-900/30 px-1.5 py-0.5">Admin only</span>
                </label>
                <textarea value={s.personal_reflection ?? ''} onChange={e => setS(prev => ({ ...prev, personal_reflection: e.target.value }))} rows={6} className="vault-input w-full resize-none" />
              </div>
            )}

            <TextAreaField label="Counsellor notes" value={s.counsellor_notes ?? ''} onChange={value => setS(prev => ({ ...prev, counsellor_notes: value }))} rows={4} />
            <TextAreaField label="Lawyer notes" value={s.lawyer_notes ?? ''} onChange={value => setS(prev => ({ ...prev, lawyer_notes: value }))} rows={4} />

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={s.is_sensitive} onChange={e => setS(prev => ({ ...prev, is_sensitive: e.target.checked }))} className="accent-red-800 w-4 h-4" />
              <span className="text-[11px] font-mono text-zinc-500">Mark as sensitive (hides entire session from viewers)</span>
            </label>
          </>
        ) : (
          <>
            {s.brief_notes && <ReadField label="Brief notes" restricted={isRestrictedSessionField(role, s, 'brief_notes')}>{visibleSessionText(role, s, 'brief_notes', s.brief_notes)}</ReadField>}
            {s.any_incidents && <ReadField label="Any Incidents" restricted={isSensitive('any_incidents')}>{s.any_incidents}</ReadField>}
            {s.notes && <ReadField label="Notes" restricted={isRestrictedSessionField(role, s, 'notes')}>{visibleSessionText(role, s, 'notes', s.notes)}</ReadField>}
            {s.counsellor_notes && <ReadField label="Counsellor notes" restricted={isRestrictedSessionField(role, s, 'counsellor_notes')}>{visibleSessionText(role, s, 'counsellor_notes', s.counsellor_notes)}</ReadField>}
            {s.lawyer_notes && <ReadField label="Lawyer notes" restricted={isRestrictedSessionField(role, s, 'lawyer_notes')}>{visibleSessionText(role, s, 'lawyer_notes', s.lawyer_notes)}</ReadField>}
            {s.personal_reflection && <ReadField label="Private Notes" restricted={isRestrictedSessionField(role, s, 'private_notes')}>{visibleSessionText(role, s, 'private_notes', s.personal_reflection)}</ReadField>}
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

function TextAreaField({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className="vault-input w-full resize-none" />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 px-3 py-2">
      <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-700">{label}</p>
      <p className="mt-1 text-[11px] font-mono text-zinc-400">{value}</p>
    </div>
  )
}
