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

  const [sleepInput, setSleepInput] = useState('')
  const [addingSleep, setAddingSleep] = useState(false)
  const [showSleepInput, setShowSleepInput] = useState(false)

  const [drugUseLog, setDrugUseLog] = useState<DrugUseLog[]>(initialDrugUseLog)
  const [showUsageInput, setShowUsageInput] = useState(false)
  const [usageForm, setUsageForm] = useState({ substance: 'ice', amount: '', unit: '', notes: '' })
  const [addingUsage, setAddingUsage] = useState(false)
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null)
  const [editingUsageForm, setEditingUsageForm] = useState({ substance: '', amount: '', unit: '', notes: '' })
  const [savingUsage, setSavingUsage] = useState(false)

  const [entries, setEntries] = useState<TrackerEntry[]>(initialEntries)
  const [showEntryInput, setShowEntryInput] = useState(false)
  const [entryContent, setEntryContent] = useState('')
  const [addingEntry, setAddingEntry] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingEntryContent, setEditingEntryContent] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)

  const [sessionMoods, setSessionMoods] = useState<SessionMood[]>(initialSessionMoods)
  const [showMoodInput, setShowMoodInput] = useState(false)
  const [moodForm, setMoodForm] = useState({ mood: '', notes: '' })
  const [addingMood, setAddingMood] = useState(false)
  const [editingMoodId, setEditingMoodId] = useState<string | null>(null)
  const [editingMoodForm, setEditingMoodForm] = useState({ mood: '', notes: '' })
  const [savingMood, setSavingMood] = useState(false)

  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>(initialSessionNotes)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const [linkedIncidents, setLinkedIncidents] = useState<LinkedIncident[]>(initialLinkedIncidents)
  const [availableIncidents, setAvailableIncidents] = useState<LinkedIncident[]>(initialAvailableIncidents)
  const [selectedIncidentId, setSelectedIncidentId] = useState('')
  const [linkingIncident, setLinkingIncident] = useState(false)

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
    setSensitiveFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])
  }

  function isSensitive(field: string) {
    return sensitiveFields.includes(field)
  }

  function startEditUsageEntry(entry: DrugUseLog) {
    setEditingUsageId(entry.id)
    setEditingUsageForm({
      substance: entry.substance ?? 'ice',
      amount: entry.amount != null ? String(entry.amount) : '',
      unit: entry.unit ?? '',
      notes: entry.notes ?? '',
    })
  }

  function cancelEditUsageEntry() {
    setEditingUsageId(null)
    setEditingUsageForm({ substance: '', amount: '', unit: '', notes: '' })
  }

  async function saveUsageEntry(id: string) {
    if (!editingUsageForm.substance.trim()) { toast.error('Substance is required.'); return }
    setSavingUsage(true)
    const supabase = createClient()
    const payload = {
      substance: editingUsageForm.substance.trim(),
      amount: editingUsageForm.amount ? parseFloat(editingUsageForm.amount) : null,
      unit: editingUsageForm.unit.trim() || null,
      notes: editingUsageForm.notes.trim() || null,
    }
    const { data, error } = await supabase.from('drug_use_log').update(payload).eq('id', id).select().single()
    if (error) toast.error('Failed to update usage entry.')
    else {
      setDrugUseLog(prev => prev.map(entry => entry.id === id ? { ...entry, ...(data ?? {}), ...payload } : entry))
      cancelEditUsageEntry()
      toast.success('Usage entry updated.')
    }
    setSavingUsage(false)
  }

  function startEditEntry(entry: TrackerEntry) {
    setEditingEntryId(entry.id)
    setEditingEntryContent(entry.content ?? '')
  }

  function cancelEditEntry() {
    setEditingEntryId(null)
    setEditingEntryContent('')
  }

  async function saveEntryEdit(id: string) {
    const content = editingEntryContent.trim()
    if (!content) { toast.error('Entry cannot be empty.'); return }
    setSavingEntry(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('tracker_entries').update({ content }).eq('id', id).select().single()
    if (error) toast.error('Failed to update entry.')
    else {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, ...(data ?? {}), content } : e))
      cancelEditEntry()
      toast.success('Entry updated.')
    }
    setSavingEntry(false)
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
    if (logErr || sessErr) toast.error('Failed to record sleep.')
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
    if (error) toast.error('Failed to log usage.')
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
    if (error) toast.error('Failed to delete.')
    else setDrugUseLog(prev => prev.filter(e => e.id !== id))
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
      const fallback = await supabase.from('tracker_entries').insert({ session_id: s.id, content: entryContent.trim(), source: 'ui' }).select().single()
      data = fallback.data
      error = fallback.error
    }
    if (error) toast.error('Failed to add entry.')
    else {
      setEntries(prev => [data, ...prev])
      setEntryContent('')
      setShowEntryInput(false)
      toast.success('Entry added.')
    }
    setAddingEntry(false)
  }

  async function deleteEntry(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('tracker_entries').delete().eq('id', id)
    if (error) toast.error('Failed to delete.')
    else setEntries(prev => prev.filter(e => e.id !== id))
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
      const fallback = await supabase.from('tracker_entries').insert({ session_id: s.id, content: `Mood: ${content}`, source: 'ui' }).select().single()
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

  function startEditMood(mood: SessionMood) {
    setEditingMoodId(mood.id)
    setEditingMoodForm({ mood: mood.mood ?? '', notes: mood.notes ?? '' })
  }

  async function saveMoodEdit(id: string) {
    if (!editingMoodForm.mood.trim()) { toast.error('Mood cannot be empty.'); return }
    setSavingMood(true)
    const supabase = createClient()
    const payload = { mood: editingMoodForm.mood.trim(), notes: editingMoodForm.notes.trim() || null }
    const { data, error } = await supabase.from('session_moods').update(payload).eq('id', id).select().single()
    if (error) toast.error('Failed to update mood.')
    else {
      setSessionMoods(prev => prev.map(m => m.id === id ? { ...m, ...(data ?? {}), ...payload } : m))
      setEditingMoodId(null)
      setEditingMoodForm({ mood: '', notes: '' })
      toast.success('Mood updated.')
    }
    setSavingMood(false)
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
      const fallback = await supabase.from('tracker_entries').insert({ session_id: s.id, content: noteContent.trim(), source: 'ui' }).select().single()
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

  function startEditNote(note: SessionNote) {
    setEditingNoteId(note.id)
    setEditingNoteContent(note.content ?? note.note ?? '')
  }

  async function saveNoteEdit(id: string) {
    const content = editingNoteContent.trim()
    if (!content) { toast.error('Note cannot be empty.'); return }
    setSavingNote(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('session_notes').update({ content }).eq('id', id).select().single()
    if (error) toast.error('Failed to update note.')
    else {
      setSessionNotes(prev => prev.map(n => n.id === id ? { ...n, ...(data ?? {}), content } : n))
      setEditingNoteId(null)
      setEditingNoteContent('')
      toast.success('Note updated.')
    }
    setSavingNote(false)
  }

  async function linkIncident() {
    if (!selectedIncidentId) return
    setLinkingIncident(true)
    const supabase = createClient()
    const { error } = await supabase.from('mental_health_incidents').update({ tracker_session_id: s.id }).eq('id', selectedIncidentId)
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

  async function closeSession() {
    if (!confirm('Mark this session as ended today?')) return
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('drug_tracker_sessions').update({ date_end: today }).eq('id', s.id)
    if (error) toast.error('Failed.')
    else { setS(prev => ({ ...prev, date_end: today })); toast.success('Session closed.') }
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const updatePayload = {
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
        personal_reflection: s.personal_reflection,
        notes: s.notes,
        is_sensitive: s.is_sensitive,
        sensitive_fields: sensitiveFields,
      }
      const fallback = await supabase.from('drug_tracker_sessions').update(fallbackPayload).eq('id', s.id)
      error = fallback.error
    }
    if (error) toast.error('Save failed.')
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
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase break-words [overflow-wrap:anywhere]">{sessionLabel(s)}</h1>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">Started {formatDate(s.date_start)}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
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

      <Panel>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="section-label">Sleep Recorded</p>
            <p className="text-2xl font-mono text-zinc-200 mt-1">{s.sleep_hours}h</p>
            <p className="text-[10px] font-mono text-zinc-700 mt-1">{lastSleepHoursAgo == null ? 'No sleep entries yet' : `Last sleep entry ${lastSleepHoursAgo}h ago`}</p>
          </div>
          {isAdmin && <SmallButton tone="amber" onClick={() => setShowSleepInput(v => !v)}><Plus className="w-3 h-3" /> Add Sleep</SmallButton>}
        </div>
        {showSleepInput && (
          <InlineEditor>
            <input type="number" step="0.5" min="0.5" max="24" value={sleepInput} onChange={e => setSleepInput(e.target.value)} placeholder="Hours (e.g. 2.5)" className="vault-input flex-1 text-sm" />
            <button onClick={addSleep} disabled={addingSleep} className="action-button amber">{addingSleep ? '...' : 'Add'}</button>
          </InlineEditor>
        )}
        {sleepLog.length > 0 && <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1">{sleepLog.slice(0, 5).map(log => <RowMeta key={log.id} left={`+${log.hours_added}h`} right={formatDateTime(log.logged_at)} />)}</div>}
      </Panel>

      {(drugUseLog.length > 0 || showUsageInput || isAdmin) && (
        <Panel>
          <SectionHeader title="Usage Log" action={isAdmin ? <SmallButton tone="red" onClick={() => setShowUsageInput(v => !v)}><Plus className="w-3 h-3" /> Log Usage</SmallButton> : null} />
          {!canViewSessionField(role, s, 'usage_log') && drugUseLog.length > 0 ? <Redacted label="Usage log" /> : showUsageInput && (
            <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="Substance"><input type="text" value={usageForm.substance} onChange={e => setUsageForm(f => ({ ...f, substance: e.target.value }))} placeholder="ice" className="vault-input text-sm" /></Field>
                <Field label="Amount"><input type="number" step="any" min="0" value={usageForm.amount} onChange={e => setUsageForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="vault-input text-sm" /></Field>
                <Field label="Unit"><input type="text" value={usageForm.unit} onChange={e => setUsageForm(f => ({ ...f, unit: e.target.value }))} placeholder="g / mg / pills" className="vault-input text-sm" /></Field>
              </div>
              <Field label="Notes (optional)"><input type="text" value={usageForm.notes} onChange={e => setUsageForm(f => ({ ...f, notes: e.target.value }))} placeholder="Route, context, etc." className="vault-input text-sm" /></Field>
              <ButtonRow><button onClick={addUsage} disabled={addingUsage} className="action-button red">{addingUsage ? '...' : 'Log'}</button><button onClick={() => setShowUsageInput(false)} className="ghost-button">Cancel</button></ButtonRow>
            </div>
          )}
          {canViewSessionField(role, s, 'usage_log') && drugUseLog.length > 0 ? (
            <div className="space-y-1.5">
              {drugUseLog.map(entry => (
                <div key={entry.id} className="entry-card text-[11px] font-mono">
                  {editingUsageId === entry.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Field label="Substance"><input type="text" value={editingUsageForm.substance} onChange={e => setEditingUsageForm(f => ({ ...f, substance: e.target.value }))} className="vault-input text-sm" autoFocus /></Field>
                        <Field label="Amount"><input type="number" step="any" min="0" value={editingUsageForm.amount} onChange={e => setEditingUsageForm(f => ({ ...f, amount: e.target.value }))} className="vault-input text-sm" /></Field>
                        <Field label="Unit"><input type="text" value={editingUsageForm.unit} onChange={e => setEditingUsageForm(f => ({ ...f, unit: e.target.value }))} className="vault-input text-sm" /></Field>
                      </div>
                      <Field label="Notes"><input type="text" value={editingUsageForm.notes} onChange={e => setEditingUsageForm(f => ({ ...f, notes: e.target.value }))} className="vault-input text-sm" /></Field>
                      <ButtonRow><button onClick={() => saveUsageEntry(entry.id)} disabled={savingUsage} className="action-button red">{savingUsage ? 'Saving...' : 'Save'}</button><button onClick={cancelEditUsageEntry} className="ghost-button">Cancel</button></ButtonRow>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-zinc-300">{entry.substance}</span>
                        {(entry.amount != null || entry.unit) && <span className="text-zinc-500 ml-2">{entry.amount != null ? entry.amount : ''}{entry.unit ? ` ${entry.unit}` : ''}</span>}
                        {entry.notes && <p className="text-zinc-600 mt-0.5 text-[10px] whitespace-pre-wrap">{entry.notes}</p>}
                        <p className="text-zinc-700 mt-0.5 text-[10px]">{formatDateTime(entry.logged_at)}</p>
                      </div>
                      {isAdmin && <div className="flex items-center gap-2 shrink-0"><button onClick={() => startEditUsageEntry(entry)} className="icon-button"><Edit2 className="w-3 h-3" /></button><button onClick={() => deleteUsageEntry(entry.id)} className="icon-danger"><X className="w-3 h-3" /></button></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : canViewSessionField(role, s, 'usage_log') ? <Empty text="No usage logged yet." /> : null}
        </Panel>
      )}

      {(entries.length > 0 || showEntryInput || isAdmin) && (
        <Panel>
          <SectionHeader title={`Log entries / MCP outputs (${entries.length})`} action={isAdmin ? <SmallButton onClick={() => setShowEntryInput(v => !v)}><Plus className="w-3 h-3" /> Add Entry</SmallButton> : null} />
          {!canViewSessionField(role, s, 'mcp_outputs') && entries.length > 0 ? <Redacted label="Log entries / MCP outputs" /> : showEntryInput && (
            <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">
              <textarea value={entryContent} onChange={e => setEntryContent(e.target.value)} rows={4} placeholder="Write an entry…" className="vault-input w-full resize-none text-sm" />
              <ButtonRow><button onClick={addEntry} disabled={addingEntry} className="action-button zinc">{addingEntry ? '...' : 'Save'}</button><button onClick={() => { setShowEntryInput(false); setEntryContent('') }} className="ghost-button">Cancel</button></ButtonRow>
            </div>
          )}
          {canViewSessionField(role, s, 'mcp_outputs') && entries.length > 0 ? (
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="entry-card">
                  {editingEntryId === entry.id ? (
                    <div className="space-y-2">
                      <textarea value={editingEntryContent} onChange={e => setEditingEntryContent(e.target.value)} rows={5} className="vault-input w-full resize-none text-sm" autoFocus />
                      <ButtonRow><button onClick={() => saveEntryEdit(entry.id)} disabled={savingEntry} className="action-button zinc">{savingEntry ? 'Saving...' : 'Save'}</button><button onClick={cancelEditEntry} className="ghost-button">Cancel</button></ButtonRow>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed flex-1 min-w-0">{entry.content}</p>
                        {isAdmin && <div className="flex items-center gap-2 shrink-0 mt-0.5"><button onClick={() => startEditEntry(entry)} className="icon-button"><Edit2 className="w-3 h-3" /></button><button onClick={() => deleteEntry(entry.id)} className="icon-danger"><X className="w-3 h-3" /></button></div>}
                      </div>
                      <EntryMeta date={entry.created_at} type={entry.entry_type} source={entry.source} />
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : canViewSessionField(role, s, 'mcp_outputs') ? <Empty text="No entries yet." /> : null}
        </Panel>
      )}

      {(sessionMoods.length > 0 || showMoodInput || isAdmin) && (
        <Panel>
          <SectionHeader title={`Mood / Feeling Entries (${sessionMoods.length})`} action={isAdmin ? <SmallButton onClick={() => setShowMoodInput(v => !v)}><Plus className="w-3 h-3" /> Add Mood</SmallButton> : null} />
          {showMoodInput && <EntryCreateBox><input value={moodForm.mood} onChange={e => setMoodForm(f => ({ ...f, mood: e.target.value }))} placeholder="Mood / feeling" className="vault-input text-sm" /><input value={moodForm.notes} onChange={e => setMoodForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note" className="vault-input text-sm" /><ButtonRow><button onClick={addMood} disabled={addingMood} className="action-button zinc">{addingMood ? '...' : 'Save'}</button><button onClick={() => setShowMoodInput(false)} className="ghost-button">Cancel</button></ButtonRow></EntryCreateBox>}
          {sessionMoods.length > 0 && <div className="space-y-1.5">{sessionMoods.map(m => <div key={m.id} className="entry-card">{editingMoodId === m.id ? <div className="space-y-2"><input value={editingMoodForm.mood} onChange={e => setEditingMoodForm(f => ({ ...f, mood: e.target.value }))} className="vault-input text-sm" autoFocus /><input value={editingMoodForm.notes} onChange={e => setEditingMoodForm(f => ({ ...f, notes: e.target.value }))} className="vault-input text-sm" /><ButtonRow><button onClick={() => saveMoodEdit(m.id)} disabled={savingMood} className="action-button zinc">{savingMood ? 'Saving...' : 'Save'}</button><button onClick={() => setEditingMoodId(null)} className="ghost-button">Cancel</button></ButtonRow></div> : <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap">{m.mood}</p>{m.notes && <p className="mt-1 text-[10px] font-mono text-zinc-600 whitespace-pre-wrap">{m.notes}</p>}<p className="text-[10px] font-mono text-zinc-700 mt-1">{formatDateTime(m.occurred_at)}</p></div>{isAdmin && <button onClick={() => startEditMood(m)} className="icon-button"><Edit2 className="w-3 h-3" /></button>}</div></>}</div>)}</div>}
        </Panel>
      )}

      {(sessionNotes.length > 0 || showNoteInput || isAdmin) && (
        <Panel>
          <SectionHeader title={`Notes (${sessionNotes.length})`} action={isAdmin ? <SmallButton onClick={() => setShowNoteInput(v => !v)}><Plus className="w-3 h-3" /> Add Note</SmallButton> : null} />
          {!canViewSessionField(role, s, 'notes') && sessionNotes.length > 0 ? <Redacted label="Notes" /> : <>{showNoteInput && <EntryCreateBox><textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={4} placeholder="Write a note..." className="vault-input w-full resize-none text-sm" /><ButtonRow><button onClick={addNote} disabled={addingNote} className="action-button zinc">{addingNote ? '...' : 'Save'}</button><button onClick={() => { setShowNoteInput(false); setNoteContent('') }} className="ghost-button">Cancel</button></ButtonRow></EntryCreateBox>}{sessionNotes.length > 0 && <div className="space-y-2">{sessionNotes.map(n => <div key={n.id} className="entry-card">{editingNoteId === n.id ? <div className="space-y-2"><textarea value={editingNoteContent} onChange={e => setEditingNoteContent(e.target.value)} rows={4} className="vault-input w-full resize-none text-sm" autoFocus /><ButtonRow><button onClick={() => saveNoteEdit(n.id)} disabled={savingNote} className="action-button zinc">{savingNote ? 'Saving...' : 'Save'}</button><button onClick={() => setEditingNoteId(null)} className="ghost-button">Cancel</button></ButtonRow></div> : <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{n.content ?? n.note}</p><p className="text-[10px] font-mono text-zinc-700 mt-1">{formatDateTime(n.occurred_at)}</p></div>{isAdmin && <button onClick={() => startEditNote(n)} className="icon-button"><Edit2 className="w-3 h-3" /></button>}</div>}</div>)}</div>}</>}
        </Panel>
      )}

      {sessionEvents.length > 0 && <Panel><p className="section-label mb-3">Session Events</p><div className="space-y-1">{sessionEvents.map(e => <div key={e.id} className="entry-card flex items-center justify-between gap-3"><span className="text-[10px] font-mono text-zinc-500">[{e.event_type}]</span><span className="text-[10px] font-mono text-zinc-700">{formatDateTime(e.occurred_at)}</span></div>)}</div></Panel>}

      {(linkedIncidents.length > 0 || isAdmin) && (
        <Panel>
          <SectionHeader title={`Connected Incidents (${linkedIncidents.length})`} />
          {isAdmin && availableIncidents.length > 0 && <div className="mb-3 flex gap-2 border border-zinc-800 bg-zinc-900/30 p-3"><select value={selectedIncidentId} onChange={e => setSelectedIncidentId(e.target.value)} className="vault-input flex-1 text-sm"><option value="">Link existing incident...</option>{availableIncidents.map(incident => <option key={incident.id} value={incident.id}>{incidentLabel(incident)} - {formatDateTime(incident.occurred_at)}</option>)}</select><button onClick={linkIncident} disabled={!selectedIncidentId || linkingIncident} className="action-button amber">Link</button></div>}
          {linkedIncidents.length > 0 && <div className="space-y-1.5">{linkedIncidents.map(inc => <Link key={inc.id} href={`/incidents/${inc.id}`} className="entry-card flex items-start justify-between gap-3 hover:border-zinc-700 transition-colors group"><div className="flex items-start gap-3 min-w-0"><span className={`text-[10px] font-mono px-2 py-0.5 border shrink-0 ${sevColor(inc.severity)}`}>SEV {inc.severity}</span><div className="min-w-0"><p className="text-[10px] font-mono text-zinc-600 break-words [overflow-wrap:anywhere]">{incidentLabel(inc)} - {formatDateTime(inc.occurred_at)}</p><p className="text-xs font-mono text-zinc-400 line-clamp-2 break-words [overflow-wrap:anywhere]">{visibleIncidentText(role, inc, 'description', inc.description)}</p></div></div><div className="flex items-center gap-1.5 ml-3 shrink-0"><span className="text-zinc-700 group-hover:text-zinc-500 text-xs">-&gt;</span></div></Link>)}</div>}
        </Panel>
      )}

      <Panel>
        {editing ? (
          <div className="space-y-5">
            <TextAreaField label="Brief notes" value={s.brief_notes ?? ''} onChange={value => setS(prev => ({ ...prev, brief_notes: value }))} rows={3} />
            <TextAreaField label="Notes (public)" value={s.notes ?? ''} onChange={value => setS(prev => ({ ...prev, notes: value }))} rows={3} />
            {canViewSensitive && <TextAreaField label="Private Notes" value={s.personal_reflection ?? ''} onChange={value => setS(prev => ({ ...prev, personal_reflection: value }))} rows={6} />}
            <TextAreaField label="Counsellor notes" value={s.counsellor_notes ?? ''} onChange={value => setS(prev => ({ ...prev, counsellor_notes: value }))} rows={4} />
            <TextAreaField label="Lawyer notes" value={s.lawyer_notes ?? ''} onChange={value => setS(prev => ({ ...prev, lawyer_notes: value }))} rows={4} />
            <label className="flex items-center gap-3"><input type="checkbox" checked={s.is_sensitive} onChange={e => setS(prev => ({ ...prev, is_sensitive: e.target.checked }))} className="accent-red-800 w-4 h-4" /><span className="text-[11px] font-mono text-zinc-500">Mark as sensitive (hides entire session from viewers)</span></label>
          </div>
        ) : (
          <div className="space-y-5">
            {s.brief_notes && <ReadField label="Brief notes" restricted={isRestrictedSessionField(role, s, 'brief_notes')}>{visibleSessionText(role, s, 'brief_notes', s.brief_notes)}</ReadField>}
            {s.notes && <ReadField label="Notes" restricted={isRestrictedSessionField(role, s, 'notes')}>{visibleSessionText(role, s, 'notes', s.notes)}</ReadField>}
            {s.counsellor_notes && <ReadField label="Counsellor notes" restricted={isRestrictedSessionField(role, s, 'counsellor_notes')}>{visibleSessionText(role, s, 'counsellor_notes', s.counsellor_notes)}</ReadField>}
            {s.lawyer_notes && <ReadField label="Lawyer notes" restricted={isRestrictedSessionField(role, s, 'lawyer_notes')}>{visibleSessionText(role, s, 'lawyer_notes', s.lawyer_notes)}</ReadField>}
            {s.personal_reflection && <ReadField label="Private Notes" restricted={isRestrictedSessionField(role, s, 'private_notes')}>{visibleSessionText(role, s, 'private_notes', s.personal_reflection)}</ReadField>}
            {s.is_sensitive && <span className="text-[9px] font-mono text-red-800 tracking-widest uppercase border border-red-900/30 px-2 py-0.5">Sensitive</span>}
          </div>
        )}
      </Panel>
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="border border-zinc-800 bg-zinc-950 p-5 min-w-0 overflow-hidden">{children}</div>
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 mb-3"><p className="section-label break-words [overflow-wrap:anywhere]">{title}</p>{action}</div>
}

function SmallButton({ children, onClick, tone = 'zinc' }: { children: React.ReactNode; onClick: () => void; tone?: 'zinc' | 'amber' | 'red' }) {
  const toneClass = tone === 'amber' ? 'text-amber-800 border-amber-900/40 hover:bg-amber-950/20' : tone === 'red' ? 'text-red-800 border-red-900/40 hover:bg-red-950/20' : 'text-zinc-500 border-zinc-700 hover:bg-zinc-800'
  return <button onClick={onClick} className={`flex items-center gap-1.5 text-[11px] font-mono border px-3 py-1.5 transition-colors uppercase tracking-widest shrink-0 ${toneClass}`}>{children}</button>
}

function InlineEditor({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">{children}</div>
}

function EntryCreateBox({ children }: { children: React.ReactNode }) {
  return <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">{children}</div>
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 pt-1 flex-wrap">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="section-label">{label}</label>{children}</div>
}

function RowMeta({ left, right }: { left: string; right: string }) {
  return <div className="flex justify-between gap-3 text-[10px] font-mono text-zinc-600"><span>{left}</span><span>{right}</span></div>
}

function EntryMeta({ date, type, source }: { date: string; type?: string | null; source?: string | null }) {
  return <div className="flex items-center gap-2 mt-1.5 flex-wrap"><p className="text-[10px] font-mono text-zinc-700">{formatDateTime(date)}</p>{type && <span className="meta-pill">{type}</span>}{source === 'mcp' && <span className="meta-pill">via AI</span>}</div>
}

function Redacted({ label }: { label: string }) {
  return <p className="text-sm font-mono text-zinc-400">{label}: REDACTED</p>
}

function Empty({ text }: { text: string }) {
  return <p className="text-[11px] font-mono text-zinc-700">{text}</p>
}

function LockableField({ label, field, isSensitive, toggle, showToggle, children }: {
  label: string; field: string; isSensitive: (f: string) => boolean; toggle: (f: string) => void; showToggle: boolean; children: React.ReactNode
}) {
  const locked = isSensitive(field)
  return <div className="space-y-1.5"><div className="flex items-center justify-between gap-3"><label className="section-label">{label}</label>{showToggle && <button type="button" onClick={() => toggle(field)} title={locked ? 'Restricted to counsellors+' : 'Click to restrict to counsellors+'} className={`p-0.5 transition-colors ${locked ? 'text-red-700' : 'text-zinc-700 hover:text-zinc-500'}`}><Lock className="w-3 h-3" /></button>}</div>{children}</div>
}

function ReadField({ label, restricted, children }: { label: string; restricted: boolean; children: React.ReactNode }) {
  return <div className="space-y-1"><div className="flex items-center gap-2"><p className="section-label">{label}</p>{restricted && <span className="text-[9px] font-mono text-red-900/70 tracking-widest uppercase">Restricted</span>}</div><p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{children}</p></div>
}

function TextAreaField({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return <div className="space-y-1.5"><label className="section-label">{label}</label><textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className="vault-input w-full resize-none" /></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-zinc-800 bg-zinc-950 px-3 py-2 min-w-0 overflow-hidden"><p className="text-[9px] font-mono uppercase tracking-widest text-zinc-700 break-words [overflow-wrap:anywhere]">{label}</p><p className="mt-1 text-[11px] font-mono text-zinc-400 break-words [overflow-wrap:anywhere]">{value}</p></div>
}
