'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Edit2, Plus, StopCircle, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import RedactedText from '@/components/permissions/RedactedText'
import { incidentLabel } from '@/lib/incidents'
import { canViewSessionField, canViewVisibilityLevel, isRestrictedSessionField, normalizeSessionVisibility, sessionLabel, visibleSessionText } from '@/lib/sessions'
import { daysUp, formatDate, formatDateTime } from '@/lib/utils'
import type { DrugTrackerSession, DrugUseLog, FieldVisibilityLevel, IncidentFieldVisibility, Role, SleepLog, TrackerEntry } from '@/lib/supabase/types'

type LinkedIncident = { id: string; incident_number: number | null; occurred_at: string; severity: number; description: string; is_sensitive: boolean; sensitive_fields: string[]; field_visibility: IncidentFieldVisibility | null; police_called: boolean; ambulance_called: boolean; was_arrested: boolean; was_sectioned: boolean }
type SessionEvent = { id: string; session_id: string; event_type?: string | null; title?: string | null; content?: string | null; entry_type?: string | null; occurred_at: string }
type SessionMood = { id: string; session_id: string; mood: string; notes?: string | null; occurred_at: string }
type SessionNote = { id: string; session_id: string; note?: string; content?: string; entry_type?: string; source?: string; visibility?: FieldVisibilityLevel | null; occurred_at: string }
type Props = { session: DrugTrackerSession; sleepLog: SleepLog[]; drugUseLog: DrugUseLog[]; linkedIncidents: LinkedIncident[]; availableIncidents: LinkedIncident[]; entries: TrackerEntry[]; sessionEvents: SessionEvent[]; sessionMoods: SessionMood[]; sessionNotes: SessionNote[]; role: Role; isAdmin: boolean; canViewSensitive: boolean }

const NOTE_VISIBILITY_OPTIONS: FieldVisibilityLevel[] = ['viewer+', 'counsellor+', 'lawyer+', 'admin only']
const FIELD_VISIBILITY_OPTIONS: FieldVisibilityLevel[] = ['viewer+', 'counsellor+', 'admin only']

export default function TrackerDetailClean({ session, sleepLog: initialSleepLog, drugUseLog: initialDrugUseLog, linkedIncidents: initialLinkedIncidents, availableIncidents: initialAvailableIncidents, entries: initialEntries, sessionEvents: initialSessionEvents, sessionMoods: initialSessionMoods, sessionNotes: initialSessionNotes, role, isAdmin }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [s, setS] = useState(session)
  const [fieldVisibility, setFieldVisibility] = useState(normalizeSessionVisibility(session.field_visibility))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sleepLog, setSleepLog] = useState<SleepLog[]>(initialSleepLog)
  const [showSleepInput, setShowSleepInput] = useState(false)
  const [sleepInput, setSleepInput] = useState('')
  const [addingSleep, setAddingSleep] = useState(false)
  const [sessionMoods, setSessionMoods] = useState<SessionMood[]>(initialSessionMoods)
  const [showMoodInput, setShowMoodInput] = useState(false)
  const [moodForm, setMoodForm] = useState({ mood: '', notes: '' })
  const [addingMood, setAddingMood] = useState(false)
  const [drugUseLog, setDrugUseLog] = useState<DrugUseLog[]>(initialDrugUseLog)
  const [showUsageInput, setShowUsageInput] = useState(false)
  const [usageForm, setUsageForm] = useState({ substance: 'ice', amount: '', unit: '', notes: '' })
  const [addingUsage, setAddingUsage] = useState(false)
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>(initialSessionNotes)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteVisibility, setNoteVisibility] = useState<FieldVisibilityLevel>('viewer+')
  const [addingNote, setAddingNote] = useState(false)
  const [linkedIncidents, setLinkedIncidents] = useState<LinkedIncident[]>(initialLinkedIncidents)
  const [availableIncidents, setAvailableIncidents] = useState<LinkedIncident[]>(initialAvailableIncidents)
  const [selectedIncidentId, setSelectedIncidentId] = useState('')
  const [linkingIncident, setLinkingIncident] = useState(false)
  const [entries] = useState<TrackerEntry[]>(initialEntries)
  const [sessionEvents] = useState<SessionEvent[]>(initialSessionEvents)

  const days = daysUp(s.date_start, s.date_end)
  const totalDaysLabel = `Day ${days}`
  const lastSleep = sleepLog[0] ?? null
  const lastSleepTimeAgo = lastSleep ? Math.max(0, Math.floor((Date.now() - new Date(lastSleep.logged_at).getTime()) / (1000 * 60 * 60))) : null
  const sessionForVisibility = { field_visibility: fieldVisibility }
  const visibleNotes = sessionNotes.filter(note => canViewVisibilityLevel(role, note.visibility ?? 'viewer+'))
  const sessionLogItems = useMemo(
    () => [
      ...entries.map(entry => ({ id: `entry-${entry.id}`, occurred_at: entry.created_at, label: entry.entry_type || entry.source || 'log entry', content: entry.content, kind: 'entry', source: entry.source || 'ui' })),
      ...sessionEvents.map(event => ({ id: `event-${event.id}`, occurred_at: event.occurred_at, label: event.event_type || event.entry_type || event.title || 'session event', content: event.content || '', kind: 'event', source: 'system' })),
    ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
    [entries, sessionEvents]
  )

  async function closeSession() {
    if (!confirm('Mark this session as ended today?')) return
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('drug_tracker_sessions').update({ date_end: today }).eq('id', s.id)
    if (error) return toast.error('Failed to close session.')
    setS(prev => ({ ...prev, date_end: today }))
    toast.success('Session closed.')
  }

  async function saveSession() {
    setSaving(true)
    const payload = {
      brief_notes: s.brief_notes,
      counsellor_notes: s.counsellor_notes,
      lawyer_notes: s.lawyer_notes,
      personal_reflection: s.personal_reflection,
      is_sensitive: s.is_sensitive,
      field_visibility: { ...fieldVisibility, counsellor_notes: 'counsellor+', lawyer_notes: 'lawyer+' },
    }
    const { error } = await supabase.from('drug_tracker_sessions').update(payload).eq('id', s.id)
    setSaving(false)
    if (error) return toast.error('Save failed.')
    setEditing(false)
    toast.success('Saved.')
  }

  async function deleteSession() {
    if (!confirm('Delete this session permanently?')) return
    setDeleting(true)
    await supabase.from('drug_tracker_sessions').delete().eq('id', s.id)
    toast.success('Deleted.')
    router.push('/tracker')
  }

  async function addSleep() {
    const hours = parseFloat(sleepInput)
    if (Number.isNaN(hours) || hours <= 0) return toast.error('Enter valid sleep hours.')
    setAddingSleep(true)
    const newTotal = Number(s.sleep_hours) + hours
    const [{ data: logRow, error: logError }, { error: sessionError }] = await Promise.all([
      supabase.from('sleep_log').insert({ session_id: s.id, hours_added: hours }).select().single(),
      supabase.from('drug_tracker_sessions').update({ sleep_hours: newTotal }).eq('id', s.id),
    ])
    setAddingSleep(false)
    if (logError || sessionError || !logRow) return toast.error('Failed to add sleep.')
    setSleepLog(prev => [logRow, ...prev])
    setS(prev => ({ ...prev, sleep_hours: newTotal }))
    setSleepInput('')
    setShowSleepInput(false)
    toast.success('Sleep added.')
  }

  async function addMood() {
    if (!moodForm.mood.trim()) return toast.error('Mood cannot be empty.')
    setAddingMood(true)
    const { data, error } = await supabase.from('session_moods').insert({ session_id: s.id, mood: moodForm.mood.trim(), notes: moodForm.notes.trim() || null, source: 'app' }).select().single()
    setAddingMood(false)
    if (error || !data) return toast.error('Failed to add mood.')
    setSessionMoods(prev => [data, ...prev])
    setMoodForm({ mood: '', notes: '' })
    setShowMoodInput(false)
    toast.success('Mood added.')
  }

  async function addUsage() {
    if (!usageForm.substance.trim()) return toast.error('Substance is required.')
    setAddingUsage(true)
    const payload = { session_id: s.id, substance: usageForm.substance.trim(), amount: usageForm.amount ? parseFloat(usageForm.amount) : null, unit: usageForm.unit.trim() || null, notes: usageForm.notes.trim() || null }
    const { data, error } = await supabase.from('drug_use_log').insert(payload).select().single()
    setAddingUsage(false)
    if (error || !data) return toast.error('Failed to log usage.')
    setDrugUseLog(prev => [data, ...prev])
    setUsageForm({ substance: 'ice', amount: '', unit: '', notes: '' })
    setShowUsageInput(false)
    toast.success('Usage logged.')
  }

  async function addNote() {
    if (!noteContent.trim()) return toast.error('Note cannot be empty.')
    setAddingNote(true)
    const { data, error } = await supabase.from('session_notes').insert({ session_id: s.id, content: noteContent.trim(), source: 'app', entry_type: 'note', visibility: noteVisibility }).select().single()
    setAddingNote(false)
    if (error || !data) return toast.error('Failed to add note.')
    setSessionNotes(prev => [data, ...prev])
    setNoteContent('')
    setNoteVisibility('viewer+')
    setShowNoteInput(false)
    toast.success('Note added.')
  }

  async function linkIncident() {
    if (!selectedIncidentId) return
    setLinkingIncident(true)
    const { error } = await supabase.from('mental_health_incidents').update({ tracker_session_id: s.id }).eq('id', selectedIncidentId)
    setLinkingIncident(false)
    if (error) return toast.error('Failed to link incident.')
    const incident = availableIncidents.find(item => item.id === selectedIncidentId)
    if (incident) {
      setLinkedIncidents(prev => [incident, ...prev])
      setAvailableIncidents(prev => prev.filter(item => item.id !== selectedIncidentId))
    }
    setSelectedIncidentId('')
    toast.success('Incident linked.')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase break-words [overflow-wrap:anywhere]">{sessionLabel(s)}</h1>
          <p className="text-[10px] font-mono text-zinc-600 mt-1">Started {formatDate(s.date_start)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/tracker/${s.id}/report`} className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 transition-colors">Report</Link>
          {isAdmin && (
            <>
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)} className="p-2 text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
                  <button onClick={saveSession} disabled={saving} className="p-2 text-green-700 hover:text-green-500"><Check className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  {!s.date_end && <button onClick={closeSession} className="p-2 text-amber-800 hover:text-amber-600"><StopCircle className="w-4 h-4" /></button>}
                  <button onClick={() => setEditing(true)} className="p-2 text-zinc-500 hover:text-zinc-300"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={deleteSession} disabled={deleting} className="p-2 text-red-900 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Panel>
        <div className="text-center">
          <p className="text-4xl font-mono font-bold text-zinc-200">{days}</p>
          <p className="text-[10px] tracking-[0.4em] uppercase font-mono text-zinc-600 mt-2">Days since start</p>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Started" value={formatDate(s.date_start)} />
        <Metric label="Ended" value={s.date_end ? formatDate(s.date_end) : 'Open'} />
        <Metric label="Total days" value={totalDaysLabel} />
        <Metric label="Linked incidents" value={String(linkedIncidents.length)} />
      </div>

      <Panel>
        <SectionHeader title="Session end details" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Metric label="Started date" value={formatDate(s.date_start)} />
          <Metric label="Ended date" value={s.date_end ? formatDate(s.date_end) : 'Still open'} />
          <Metric label="Final sleep total" value={`${s.sleep_hours}h`} />
          <Metric label="Linked incident count" value={String(linkedIncidents.length)} />
        </div>
      </Panel>

      <Panel>
        <SectionHeader title="Sleep log" action={isAdmin ? <SmallButton tone="amber" onClick={() => setShowSleepInput(v => !v)}><Plus className="w-3 h-3" /> Add sleep</SmallButton> : undefined} />
        <p className="text-sm font-mono text-zinc-300">Total sleep: {s.sleep_hours}h</p>
        <p className="text-[10px] font-mono text-zinc-700 mt-1">{lastSleepTimeAgo == null ? 'No sleep entries yet' : `Time since last sleep entry: ${lastSleepTimeAgo}h`}</p>
        {showSleepInput && <EntryCreateBox><input value={sleepInput} onChange={e => setSleepInput(e.target.value)} type="number" step="0.5" min="0.5" className="vault-input w-full text-sm" placeholder="Hours" /><ButtonRow><button onClick={addSleep} disabled={addingSleep} className="action-button amber">{addingSleep ? '...' : 'Add'}</button><button onClick={() => setShowSleepInput(false)} className="ghost-button">Cancel</button></ButtonRow></EntryCreateBox>}
        {sleepLog.length > 0 ? <div className="mt-3 space-y-1.5">{sleepLog.map(log => <RowMeta key={log.id} left={`+${log.hours_added}h`} right={formatDateTime(log.logged_at)} />)}</div> : <Empty text="No sleep entries." />}
      </Panel>

      {(s.brief_notes || editing) && <Panel><SectionHeader title="Brief notes" />{editing ? <div className="space-y-3"><textarea value={s.brief_notes ?? ''} onChange={e => setS(prev => ({ ...prev, brief_notes: e.target.value }))} rows={3} className="vault-input w-full resize-none" /><PermissionSelect label="Brief notes permission" value={fieldVisibility.brief_notes ?? 'viewer+'} options={FIELD_VISIBILITY_OPTIONS} onChange={value => setFieldVisibility(prev => ({ ...prev, brief_notes: value }))} /></div> : isRestrictedSessionField(role, sessionForVisibility, 'brief_notes') && s.brief_notes ? <RedactedText size="sm" /> : s.brief_notes ? <ReadField label="Brief notes" restricted={false}>{visibleSessionText(role, sessionForVisibility, 'brief_notes', s.brief_notes)}</ReadField> : null}</Panel>}

      {(sessionMoods.length > 0 || showMoodInput || isAdmin) && <Panel><SectionHeader title={`Mood / feeling entries (${sessionMoods.length})`} action={isAdmin ? <SmallButton onClick={() => setShowMoodInput(v => !v)}><Plus className="w-3 h-3" /> Add mood</SmallButton> : undefined} />{showMoodInput && <EntryCreateBox><input value={moodForm.mood} onChange={e => setMoodForm(prev => ({ ...prev, mood: e.target.value }))} className="vault-input w-full text-sm" placeholder="Mood" /><textarea value={moodForm.notes} onChange={e => setMoodForm(prev => ({ ...prev, notes: e.target.value }))} rows={3} className="vault-input w-full resize-none text-sm" placeholder="Notes" /><ButtonRow><button onClick={addMood} disabled={addingMood} className="action-button zinc">{addingMood ? '...' : 'Save'}</button><button onClick={() => setShowMoodInput(false)} className="ghost-button">Cancel</button></ButtonRow></EntryCreateBox>}{sessionMoods.length > 0 ? <div className="space-y-2">{sessionMoods.map(item => <div key={item.id} className="entry-card"><p className="text-sm font-mono text-zinc-300">{item.mood}</p>{item.notes && <p className="text-[11px] font-mono text-zinc-500 mt-1 whitespace-pre-wrap">{item.notes}</p>}<EntryMeta date={item.occurred_at} /></div>)}</div> : <Empty text="No mood entries." />}</Panel>}

      {(drugUseLog.length > 0 || showUsageInput || isAdmin) && <Panel><SectionHeader title="Usage log" action={isAdmin ? <SmallButton tone="red" onClick={() => setShowUsageInput(v => !v)}><Plus className="w-3 h-3" /> Log usage</SmallButton> : undefined} />{!canViewSessionField(role, s, 'usage_log') && drugUseLog.length > 0 ? <RedactedText size="sm" /> : <>{showUsageInput && <EntryCreateBox><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input value={usageForm.substance} onChange={e => setUsageForm(prev => ({ ...prev, substance: e.target.value }))} className="vault-input text-sm" placeholder="Substance" /><input value={usageForm.amount} onChange={e => setUsageForm(prev => ({ ...prev, amount: e.target.value }))} className="vault-input text-sm" placeholder="Amount" type="number" /><input value={usageForm.unit} onChange={e => setUsageForm(prev => ({ ...prev, unit: e.target.value }))} className="vault-input text-sm" placeholder="Unit" /></div><input value={usageForm.notes} onChange={e => setUsageForm(prev => ({ ...prev, notes: e.target.value }))} className="vault-input text-sm" placeholder="Notes" /><ButtonRow><button onClick={addUsage} disabled={addingUsage} className="action-button red">{addingUsage ? '...' : 'Log'}</button><button onClick={() => setShowUsageInput(false)} className="ghost-button">Cancel</button></ButtonRow></EntryCreateBox>}{drugUseLog.length > 0 ? <div className="space-y-2">{drugUseLog.map(item => <div key={item.id} className="entry-card"><p className="text-sm font-mono text-zinc-300">{item.substance}{item.amount != null ? ` ${item.amount}` : ''}{item.unit ? ` ${item.unit}` : ''}</p>{item.notes && <p className="text-[11px] font-mono text-zinc-500 mt-1 whitespace-pre-wrap">{item.notes}</p>}<EntryMeta date={item.logged_at} /></div>)}</div> : <Empty text="No usage logged yet." />}</>}</Panel>}

      {(visibleNotes.length > 0 || showNoteInput || isAdmin || !!s.notes) && <Panel><SectionHeader title={`Notes (${visibleNotes.length + (s.notes ? 1 : 0)})`} action={isAdmin ? <SmallButton onClick={() => setShowNoteInput(v => !v)}><Plus className="w-3 h-3" /> Add note</SmallButton> : undefined} />{showNoteInput && <EntryCreateBox><textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={4} className="vault-input w-full resize-none text-sm" placeholder="Write a note entry..." /><PermissionSelect label="Permission" value={noteVisibility} options={NOTE_VISIBILITY_OPTIONS} onChange={setNoteVisibility} /><ButtonRow><button onClick={addNote} disabled={addingNote} className="action-button zinc">{addingNote ? '...' : 'Save'}</button><button onClick={() => setShowNoteInput(false)} className="ghost-button">Cancel</button></ButtonRow></EntryCreateBox>}<div className="space-y-2">{s.notes && <div className="entry-card"><p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap">{s.notes}</p><p className="text-[10px] font-mono text-zinc-700 mt-1">legacy note</p></div>}{visibleNotes.map(note => <div key={note.id} className="entry-card"><p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap">{note.content ?? note.note}</p><p className="text-[10px] font-mono text-zinc-700 mt-1">{note.visibility ?? 'viewer+'} · {formatDateTime(note.occurred_at)}</p></div>)}</div>{!s.notes && visibleNotes.length === 0 && <Empty text="No notes." />}</Panel>}

      {(linkedIncidents.length > 0 || isAdmin) && <Panel><SectionHeader title={`Connected to any incidents (${linkedIncidents.length})`} />{isAdmin && availableIncidents.length > 0 && <div className="mb-3 flex gap-2 border border-zinc-800 bg-zinc-900/30 p-3"><select value={selectedIncidentId} onChange={e => setSelectedIncidentId(e.target.value)} className="vault-input flex-1 text-sm"><option value="">Link existing incident...</option>{availableIncidents.map(incident => <option key={incident.id} value={incident.id}>{incidentLabel(incident)} - {formatDateTime(incident.occurred_at)}</option>)}</select><button onClick={linkIncident} disabled={!selectedIncidentId || linkingIncident} className="action-button amber">Link</button></div>}{linkedIncidents.length > 0 ? <div className="space-y-2">{linkedIncidents.map(incident => <Link key={incident.id} href={`/incidents/${incident.id}`} className="entry-card block hover:border-zinc-700 transition-colors"><p className="text-sm font-mono text-zinc-300">{incidentLabel(incident)}</p><p className="text-[10px] font-mono text-zinc-700 mt-1">Severity {incident.severity} · {formatDateTime(incident.occurred_at)}</p></Link>)}</div> : <Empty text="No linked incidents." />}</Panel>}

      {(s.counsellor_notes || editing) && <Panel><SectionHeader title="Counsellor notes" />{editing ? <textarea value={s.counsellor_notes ?? ''} onChange={e => setS(prev => ({ ...prev, counsellor_notes: e.target.value }))} rows={4} className="vault-input w-full resize-none" /> : role === 'admin' || role === 'counsellor' ? (s.counsellor_notes ? <ReadField label="Counsellor notes" restricted={false}>{s.counsellor_notes}</ReadField> : <Empty text="No counsellor notes." />) : s.counsellor_notes ? <RedactedText size="sm" /> : null}</Panel>}

      {(s.lawyer_notes || editing) && <Panel><SectionHeader title="Lawyer notes" />{editing ? <textarea value={s.lawyer_notes ?? ''} onChange={e => setS(prev => ({ ...prev, lawyer_notes: e.target.value }))} rows={4} className="vault-input w-full resize-none" /> : role === 'admin' || role === 'lawyer' ? (s.lawyer_notes ? <ReadField label="Lawyer notes" restricted={false}>{s.lawyer_notes}</ReadField> : <Empty text="No lawyer notes." />) : s.lawyer_notes ? <RedactedText size="sm" /> : null}</Panel>}

      {(s.personal_reflection || editing) && <Panel><SectionHeader title="Private notes" />{editing ? <div className="space-y-3"><textarea value={s.personal_reflection ?? ''} onChange={e => setS(prev => ({ ...prev, personal_reflection: e.target.value }))} rows={5} className="vault-input w-full resize-none" /><PermissionSelect label="Private notes permission" value={fieldVisibility.private_notes ?? 'admin only'} options={FIELD_VISIBILITY_OPTIONS} onChange={value => setFieldVisibility(prev => ({ ...prev, private_notes: value }))} /></div> : isRestrictedSessionField(role, sessionForVisibility, 'private_notes') && s.personal_reflection ? <RedactedText size="sm" /> : s.personal_reflection ? <ReadField label="Private notes" restricted={false}>{visibleSessionText(role, sessionForVisibility, 'private_notes', s.personal_reflection)}</ReadField> : null}</Panel>}

      {(sessionLogItems.length > 0 || isAdmin) && <Panel><SectionHeader title={`Session log (${sessionLogItems.length})`} />{!canViewSessionField(role, s, 'mcp_outputs') && sessionLogItems.length > 0 ? <RedactedText size="sm" /> : sessionLogItems.length > 0 ? <div className="space-y-2">{sessionLogItems.map(item => <div key={item.id} className="entry-card"><p className="text-sm font-mono text-zinc-300 break-words [overflow-wrap:anywhere]">{item.label}</p>{item.content && <p className="text-[11px] font-mono text-zinc-500 mt-1 whitespace-pre-wrap">{item.content}</p>}<p className="text-[10px] font-mono text-zinc-700 mt-1">{item.kind} · {item.source} · {formatDateTime(item.occurred_at)}</p></div>)}</div> : <Empty text="No session log entries." />}</Panel>}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) { return <div className="border border-zinc-800 bg-zinc-950 p-5 min-w-0 overflow-hidden">{children}</div> }
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 mb-3"><p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 break-words [overflow-wrap:anywhere]">{title}</p>{action}</div> }
function SmallButton({ children, onClick, tone = 'zinc' }: { children: React.ReactNode; onClick: () => void; tone?: 'zinc' | 'amber' | 'red' }) { const toneClass = tone === 'amber' ? 'text-amber-800 border-amber-900/40 hover:bg-amber-950/20' : tone === 'red' ? 'text-red-800 border-red-900/40 hover:bg-red-950/20' : 'text-zinc-500 border-zinc-700 hover:bg-zinc-800'; return <button onClick={onClick} className={`flex items-center gap-1.5 text-[11px] font-mono border px-3 py-1.5 transition-colors uppercase tracking-widest shrink-0 ${toneClass}`}>{children}</button> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-zinc-800 bg-zinc-950 px-3 py-2 min-w-0 overflow-hidden"><p className="text-[9px] font-mono uppercase tracking-widest text-zinc-700 break-words [overflow-wrap:anywhere]">{label}</p><p className="mt-1 text-[11px] font-mono text-zinc-400 break-words [overflow-wrap:anywhere]">{value}</p></div> }
function PermissionSelect({ label, value, options, onChange }: { label: string; value: FieldVisibilityLevel; options: FieldVisibilityLevel[]; onChange: (value: FieldVisibilityLevel) => void }) { return <div className="space-y-1.5"><label className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">{label}</label><select value={value} onChange={e => onChange(e.target.value as FieldVisibilityLevel)} className="vault-input text-sm">{options.map(option => <option key={option} value={option}>{option}</option>)}</select></div> }
function ButtonRow({ children }: { children: React.ReactNode }) { return <div className="flex items-center gap-2 pt-1 flex-wrap">{children}</div> }
function EntryCreateBox({ children }: { children: React.ReactNode }) { return <div className="border border-zinc-800 bg-zinc-900/30 p-4 mb-3 space-y-3">{children}</div> }
function Empty({ text }: { text: string }) { return <p className="text-[11px] font-mono text-zinc-700">{text}</p> }
function EntryMeta({ date }: { date: string }) { return <p className="text-[10px] font-mono text-zinc-700 mt-1">{formatDateTime(date)}</p> }
function ReadField({ label, restricted, children }: { label: string; restricted: boolean; children: React.ReactNode }) { return <div className="space-y-1"><div className="flex items-center gap-2"><p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">{label}</p>{restricted && <span className="text-[9px] font-mono text-red-900/70 tracking-widest uppercase">Restricted</span>}</div><p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{children}</p></div> }
function RowMeta({ left, right }: { left: string; right: string }) { return <div className="flex justify-between gap-3 text-[10px] font-mono text-zinc-600"><span>{left}</span><span>{right}</span></div> }
