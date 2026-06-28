'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime, daysUp } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, X, Check, StopCircle, Lock } from 'lucide-react'
import type { DrugTrackerSession, FieldVisibilityLevel, IncidentFieldVisibility, Role, SessionFieldKey, SessionFieldVisibility, SleepLog, DrugUseLog, TrackerEntry } from '@/lib/supabase/types'
import { canViewSessionField, incidentLabel, normalizeSessionVisibility, REDACTED, sessionLabel, visibleIncidentText, visibleSessionText } from '@/lib/visibility'

interface SessionEvent {
  id: string
  session_id: string
  event_type: string
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
  note: string
  entry_type?: string | null
  source?: string | null
  visibility?: FieldVisibilityLevel | null
  occurred_at: string
}

interface LinkedIncident {
  id: string
  incident_number?: number | null
  occurred_at: string
  severity: number
  description: string
  field_visibility: IncidentFieldVisibility
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
  entries: TrackerEntry[]
  sessionEvents: SessionEvent[]
  sessionMoods: SessionMood[]
  sessionNotes: SessionNote[]
  role: Role
  isAdmin: boolean
}

export default function TrackerDetail({ session, sleepLog, drugUseLog: initialDrugUseLog, linkedIncidents, entries: initialEntries, sessionEvents, sessionMoods: initialMoods, sessionNotes: initialNotes, role, isAdmin }: Props) {
  const router = useRouter()
  const [s, setS] = useState(session)
  const [editing, setEditing] = useState(false)
  const [fieldVisibility, setFieldVisibility] = useState<SessionFieldVisibility>(normalizeSessionVisibility(session.field_visibility))
  const [sleepInput, setSleepInput] = useState('')
  const [showSleepInput, setShowSleepInput] = useState(false)
  const [drugUseLog, setDrugUseLog] = useState<DrugUseLog[]>(initialDrugUseLog)
  const [showUsageInput, setShowUsageInput] = useState(false)
  const [usageForm, setUsageForm] = useState({ substance: 'ice', amount: '', unit: '', notes: '' })
  const [entries, setEntries] = useState<TrackerEntry[]>(initialEntries)
  const [showEntryInput, setShowEntryInput] = useState(false)
  const [entryContent, setEntryContent] = useState('')
  const [moods, setMoods] = useState<SessionMood[]>(initialMoods)
  const [showMoodInput, setShowMoodInput] = useState(false)
  const [moodInput, setMoodInput] = useState('')
  const [notes, setNotes] = useState<SessionNote[]>(initialNotes)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [busy, setBusy] = useState(false)

  const days = daysUp(s.date_start, s.date_end)
  const isOngoing = !s.date_end
  const visibility = normalizeSessionVisibility(fieldVisibility)

  function setVisibility(field: SessionFieldKey, level: FieldVisibilityLevel) {
    setFieldVisibility(prev => ({ ...prev, [field]: level }))
  }

  async function addSleep() {
    const hrs = parseFloat(sleepInput)
    if (isNaN(hrs) || hrs <= 0) { toast.error('Enter valid sleep hours.'); return }
    setBusy(true)
    const supabase = createClient()
    const newTotal = Number(s.sleep_hours) + hrs
    const [{ error: logErr }, { error: sessErr }] = await Promise.all([
      supabase.from('sleep_log').insert({ session_id: s.id, hours_added: hrs }),
      supabase.from('drug_tracker_sessions').update({ sleep_hours: newTotal }).eq('id', s.id),
    ])
    if (logErr || sessErr) toast.error('Failed to record sleep.')
    else { setS(prev => ({ ...prev, sleep_hours: newTotal })); setSleepInput(''); setShowSleepInput(false); toast.success(`+${hrs}h added.`); router.refresh() }
    setBusy(false)
  }

  async function addUsage() {
    if (!usageForm.substance.trim()) { toast.error('Substance is required.'); return }
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('drug_use_log').insert({
      session_id: s.id,
      substance: usageForm.substance.trim() || 'ice',
      amount: usageForm.amount ? parseFloat(usageForm.amount) : null,
      unit: usageForm.unit.trim() || null,
      notes: usageForm.notes.trim() || null,
    }).select().single()
    if (error) toast.error('Failed to log usage.')
    else { setDrugUseLog(prev => [data, ...prev]); setUsageForm({ substance: 'ice', amount: '', unit: '', notes: '' }); setShowUsageInput(false); toast.success('Usage logged.') }
    setBusy(false)
  }

  async function addMood() {
    if (!moodInput.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('session_moods').insert({ session_id: s.id, mood: moodInput.trim(), source: 'app' }).select().single()
    if (error) toast.error('Failed to add mood.')
    else { setMoods(prev => [...prev, data]); setMoodInput(''); setShowMoodInput(false); toast.success('Mood added.') }
    setBusy(false)
  }

  async function addNote() {
    if (!noteInput.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('session_notes').insert({ session_id: s.id, note: noteInput.trim(), source: 'app', entry_type: 'note', visibility: visibility.notes }).select().single()
    if (error) toast.error('Failed to add note.')
    else { setNotes(prev => [...prev, data]); setNoteInput(''); setShowNoteInput(false); toast.success('Note added.') }
    setBusy(false)
  }

  async function addEntry() {
    if (!entryContent.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('tracker_entries').insert({ session_id: s.id, content: entryContent.trim(), source: 'ui', entry_type: 'manual', visibility: visibility.mcp_outputs }).select().single()
    if (error) toast.error('Failed to add entry.')
    else { setEntries(prev => [data, ...prev]); setEntryContent(''); setShowEntryInput(false); toast.success('Entry added.') }
    setBusy(false)
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
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('drug_tracker_sessions').update({
      brief_notes: s.brief_notes,
      counsellor_notes: s.counsellor_notes,
      lawyer_notes: s.lawyer_notes,
      personal_reflection: s.personal_reflection,
      notes: s.notes,
      any_incidents: s.any_incidents,
      is_sensitive: s.is_sensitive,
      field_visibility: normalizeSessionVisibility(fieldVisibility),
    }).eq('id', s.id)
    if (error) toast.error('Save failed.')
    else { toast.success('Saved.'); setEditing(false); router.refresh() }
    setBusy(false)
  }

  async function deleteSession() {
    if (!confirm('Delete this session permanently?')) return
    const supabase = createClient()
    await supabase.from('drug_tracker_sessions').delete().eq('id', s.id)
    toast.success('Deleted.')
    router.push('/tracker')
  }

  const lastSleep = sleepLog[0]?.logged_at

  return (
    <div className="space-y-4">
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
                <button onClick={save} disabled={busy} className="p-2 text-green-700 hover:text-green-500"><Check className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                {isOngoing && <button onClick={closeSession} className="p-2 text-amber-800 hover:text-amber-600"><StopCircle className="w-4 h-4" /></button>}
                <button onClick={() => setEditing(true)} className="p-2 text-zinc-500 hover:text-zinc-300"><Edit2 className="w-4 h-4" /></button>
                <button onClick={deleteSession} className="p-2 text-red-900 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`border p-4 text-center ${isOngoing ? 'border-amber-900/40 bg-amber-950/10' : 'border-zinc-800 bg-zinc-950'}`}>
        <p className="text-4xl font-mono font-bold text-zinc-200">{days}</p>
        <p className="text-[10px] tracking-[0.4em] uppercase font-mono text-zinc-600 mt-1">{isOngoing ? 'Days - Ongoing' : `Days - Ended ${formatDate(s.date_end!)}`}</p>
        {!isOngoing && <p className="text-[10px] font-mono text-zinc-600 mt-2">Final sleep total: {s.sleep_hours}h - linked incidents: {linkedIncidents.length}</p>}
      </div>

      <Panel title="Sleep Log" action={isAdmin ? <Action onClick={() => setShowSleepInput(v => !v)}>Add Sleep</Action> : null}>
        <p className="text-2xl font-mono text-zinc-200">{s.sleep_hours}h</p>
        {lastSleep && <p className="text-[10px] font-mono text-zinc-600 mt-1">Last sleep: {formatDateTime(lastSleep)}</p>}
        {showSleepInput && <QuickNumber value={sleepInput} onChange={setSleepInput} onSave={addSleep} busy={busy} placeholder="Hours" />}
        <LogList empty="No sleep entries.">{sleepLog.map(log => <Row key={log.id} left={`+${log.hours_added}h`} right={formatDateTime(log.logged_at)} />)}</LogList>
      </Panel>

      {editing ? (
        <Panel title="Session Fields">
          <LockableField label="Brief Notes" field="brief_notes" visibility={visibility} setVisibility={setVisibility}>
            <textarea value={s.brief_notes ?? ''} onChange={e => setS(prev => ({ ...prev, brief_notes: e.target.value }))} rows={3} className="vault-input w-full resize-none" />
          </LockableField>
          <LockableField label="Notes" field="notes" visibility={visibility} setVisibility={setVisibility}>
            <textarea value={s.notes ?? ''} onChange={e => setS(prev => ({ ...prev, notes: e.target.value }))} rows={3} className="vault-input w-full resize-none" />
          </LockableField>
          <LockableField label="Counsellor Notes" field="counsellor_notes" visibility={visibility} setVisibility={setVisibility}>
            <textarea value={s.counsellor_notes ?? ''} onChange={e => setS(prev => ({ ...prev, counsellor_notes: e.target.value }))} rows={4} className="vault-input w-full resize-none" />
          </LockableField>
          <LockableField label="Lawyer Notes" field="lawyer_notes" visibility={visibility} setVisibility={setVisibility}>
            <textarea value={s.lawyer_notes ?? ''} onChange={e => setS(prev => ({ ...prev, lawyer_notes: e.target.value }))} rows={4} className="vault-input w-full resize-none" />
          </LockableField>
          <LockableField label="Private Notes" field="private_notes" visibility={visibility} setVisibility={setVisibility}>
            <textarea value={s.personal_reflection ?? ''} onChange={e => setS(prev => ({ ...prev, personal_reflection: e.target.value }))} rows={5} className="vault-input w-full resize-none" />
          </LockableField>
        </Panel>
      ) : (
        <>
          <ReadField label="Brief Notes" value={visibleSessionText(role, s, 'brief_notes', s.brief_notes)} />
          <ReadField label="Notes" value={visibleSessionText(role, s, 'notes', s.notes)} />
          <ReadField label="Counsellor Notes" value={visibleSessionText(role, s, 'counsellor_notes', s.counsellor_notes)} />
          <ReadField label="Lawyer Notes" value={visibleSessionText(role, s, 'lawyer_notes', s.lawyer_notes)} />
          <ReadField label="Private Notes" value={visibleSessionText(role, s, 'private_notes', s.personal_reflection)} />
        </>
      )}

      <RestrictedPanel title="Usage Log" allowed={canViewSessionField(role, s, 'usage_log')} hasContent={drugUseLog.length > 0} action={isAdmin ? <Action onClick={() => setShowUsageInput(v => !v)}>Log Usage</Action> : null}>
        {showUsageInput && (
          <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">
            <input value={usageForm.substance} onChange={e => setUsageForm(f => ({ ...f, substance: e.target.value }))} placeholder="ice" className="vault-input text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="any" min="0" value={usageForm.amount} onChange={e => setUsageForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount" className="vault-input text-sm" />
              <input value={usageForm.unit} onChange={e => setUsageForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unit" className="vault-input text-sm" />
            </div>
            <input value={usageForm.notes} onChange={e => setUsageForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" className="vault-input text-sm" />
            <button onClick={addUsage} disabled={busy} className="text-[11px] font-mono text-red-200 bg-red-950 border border-red-900/60 px-4 py-1.5 uppercase">Log</button>
          </div>
        )}
        <LogList empty="No usage entries.">{drugUseLog.map(entry => <Row key={entry.id} left={`${entry.substance}${entry.amount != null ? ` ${entry.amount}` : ''}${entry.unit ? ` ${entry.unit}` : ''}`} right={formatDateTime(entry.logged_at)} detail={entry.notes} />)}</LogList>
      </RestrictedPanel>

      <Panel title="Mood / Feeling Entries" action={isAdmin ? <Action onClick={() => setShowMoodInput(v => !v)}>Add Mood</Action> : null}>
        {showMoodInput && <QuickText value={moodInput} onChange={setMoodInput} onSave={addMood} busy={busy} placeholder="Mood or feeling" />}
        <LogList empty="No mood entries.">{moods.map(m => <Row key={m.id} left={m.mood} right={formatDateTime(m.occurred_at)} detail={m.notes ?? null} />)}</LogList>
      </Panel>

      <RestrictedPanel title="Notes Quick Entries" allowed={canViewSessionField(role, s, 'notes')} hasContent={notes.length > 0} action={isAdmin ? <Action onClick={() => setShowNoteInput(v => !v)}>Add Note</Action> : null}>
        {showNoteInput && <QuickText value={noteInput} onChange={setNoteInput} onSave={addNote} busy={busy} placeholder="Session note" />}
        <LogList empty="No notes.">{notes.map(n => <Row key={n.id} left={n.note} right={formatDateTime(n.occurred_at)} detail={n.source ? `source: ${n.source}` : null} />)}</LogList>
      </RestrictedPanel>

      {linkedIncidents.length > 0 && (
        <Panel title={`Connected Incidents (${linkedIncidents.length})`}>
          <div className="space-y-1.5">
            {linkedIncidents.map(inc => (
              <Link key={inc.id} href={`/incidents/${inc.id}`} className="flex items-center justify-between border border-zinc-800 hover:border-zinc-700 px-3 py-2.5 transition-colors">
                <div>
                  <p className="text-[10px] font-mono text-zinc-600">{incidentLabel(inc)}</p>
                  <p className="text-xs font-mono text-zinc-400 truncate">{visibleIncidentText(role, inc, 'description', inc.description)}</p>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">SEV {inc.severity}</span>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <RestrictedPanel title="Log entires (outputs from mcp)" allowed={canViewSessionField(role, s, 'mcp_outputs')} hasContent={entries.length > 0} action={isAdmin ? <Action onClick={() => setShowEntryInput(v => !v)}>Add Entry</Action> : null}>
        {showEntryInput && <QuickText value={entryContent} onChange={setEntryContent} onSave={addEntry} busy={busy} placeholder="Entry text" multiline />}
        <LogList empty="No entries.">{entries.map(entry => <Row key={entry.id} left={entry.content} right={formatDateTime(entry.created_at)} detail={`${entry.source}${entry.entry_type ? ` - ${entry.entry_type}` : ''}`} />)}</LogList>
      </RestrictedPanel>

      {sessionEvents.length > 0 && (
        <Panel title="Session Events">
          <LogList empty="No events.">{sessionEvents.map(e => <Row key={e.id} left={e.event_type} right={formatDateTime(e.occurred_at)} />)}</LogList>
        </Panel>
      )}
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function RestrictedPanel({ title, allowed, hasContent, action, children }: { title: string; allowed: boolean; hasContent: boolean; action?: React.ReactNode; children: React.ReactNode }) {
  if (!allowed && !hasContent) return null
  if (!allowed) return <Panel title={title}><p className="text-sm font-mono text-zinc-400">{REDACTED}</p></Panel>
  return <Panel title={title} action={action}>{children}</Panel>
}

function Action({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="flex items-center gap-1.5 text-[11px] font-mono text-amber-800 border border-amber-900/40 px-3 py-1.5 hover:bg-amber-950/20"><Plus className="w-3 h-3" />{children}</button>
}

function QuickNumber({ value, onChange, onSave, busy, placeholder }: { value: string; onChange: (v: string) => void; onSave: () => void; busy: boolean; placeholder: string }) {
  return <div className="flex gap-2"><input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="vault-input flex-1 text-sm" /><button onClick={onSave} disabled={busy} className="text-[11px] font-mono text-amber-200 bg-amber-950 border border-amber-900/60 px-4 py-2 uppercase">Add</button></div>
}

function QuickText({ value, onChange, onSave, busy, placeholder, multiline }: { value: string; onChange: (v: string) => void; onSave: () => void; busy: boolean; placeholder: string; multiline?: boolean }) {
  return (
    <div className="space-y-2">
      {multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} className="vault-input w-full resize-none text-sm" /> : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="vault-input w-full text-sm" />}
      <button onClick={onSave} disabled={busy} className="text-[11px] font-mono text-zinc-200 bg-zinc-800 border border-zinc-600 px-4 py-1.5 uppercase">Save</button>
    </div>
  )
}

function LogList({ empty, children }: { empty: string; children: React.ReactNode[] }) {
  return children.length ? <div className="space-y-1.5">{children}</div> : <p className="text-[11px] font-mono text-zinc-700">{empty}</p>
}

function Row({ left, right, detail }: { left: string; right: string; detail?: string | null }) {
  return (
    <div className="border border-zinc-800/60 px-3 py-2">
      <div className="flex justify-between gap-3 text-[11px] font-mono">
        <span className="text-zinc-300 whitespace-pre-wrap">{left}</span>
        <span className="text-zinc-700 shrink-0">{right}</span>
      </div>
      {detail && <p className="text-[10px] font-mono text-zinc-600 mt-1">{detail}</p>}
    </div>
  )
}

function LockableField({ label, field, visibility, setVisibility, children }: {
  label: string
  field: SessionFieldKey
  visibility: Required<SessionFieldVisibility>
  setVisibility: (field: SessionFieldKey, level: FieldVisibilityLevel) => void
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
  return <Panel title={label}><p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{value}</p></Panel>
}
