'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime, daysUp } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, X, Check, StopCircle } from 'lucide-react'
import type { DrugTrackerSession, SleepLog } from '@/lib/supabase/types'

interface Props { session: DrugTrackerSession; sleepLog: SleepLog[]; isAdmin: boolean; canViewSensitive: boolean }

export default function TrackerDetail({ session, sleepLog, isAdmin, canViewSensitive }: Props) {
  const router = useRouter()
  const [s, setS] = useState(session)
  const [editing, setEditing] = useState(false)
  const [sleepInput, setSleepInput] = useState('')
  const [addingSleep, setAddingSleep] = useState(false)
  const [showSleepInput, setShowSleepInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const days = daysUp(s.date_start, s.date_end)
  const isOngoing = !s.date_end

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
    else { setS(prev => ({ ...prev, sleep_hours: newTotal })); setSleepInput(''); setShowSleepInput(false); toast.success(`+${hrs}h added. Total: ${newTotal}h`) }
    setAddingSleep(false)
  }

  async function closeSession() {
    if (!confirm('Mark this session as ended today?')) return
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('drug_tracker_sessions').update({ date_end: today }).eq('id', s.id)
    if (error) { toast.error('Failed.') } else { setS(prev => ({ ...prev, date_end: today })); toast.success('Session closed.') }
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('drug_tracker_sessions').update({ any_incidents: s.any_incidents, personal_reflection: s.personal_reflection, notes: s.notes, is_sensitive: s.is_sensitive }).eq('id', s.id)
    if (error) { toast.error('Save failed.') } else { toast.success('Saved.'); setEditing(false) }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-mono tracking-widest text-zinc-300 uppercase">Session</h1>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">Started {formatDate(s.date_start)}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {editing ? (
              <><button onClick={() => setEditing(false)} className="p-2 text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button><button onClick={save} disabled={saving} className="p-2 text-green-700 hover:text-green-500"><Check className="w-4 h-4" /></button></>
            ) : (
              <>{isOngoing && <button onClick={closeSession} title="Close session" className="p-2 text-amber-800 hover:text-amber-600"><StopCircle className="w-4 h-4" /></button>}<button onClick={() => setEditing(true)} className="p-2 text-zinc-500 hover:text-zinc-300"><Edit2 className="w-4 h-4" /></button><button onClick={deleteSession} disabled={deleting} className="p-2 text-red-900 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></>
            )}
          </div>
        )}
      </div>
      <div className={`border p-4 mb-6 text-center ${isOngoing ? 'border-amber-900/40 bg-amber-950/10' : 'border-zinc-800 bg-zinc-950'}`}>
        <p className="text-4xl font-mono font-bold text-zinc-200">{days}</p>
        <p className="text-[10px] tracking-[0.4em] uppercase font-mono text-zinc-600 mt-1">{isOngoing ? 'Days — Ongoing' : `Days — Ended ${formatDate(s.date_end!)}`}</p>
      </div>
      <div className="border border-zinc-800 bg-zinc-950 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-600">Sleep Recorded</p>
            <p className="text-2xl font-mono text-zinc-200 mt-1">{s.sleep_hours}h</p>
          </div>
          {isAdmin && <button onClick={() => setShowSleepInput(v => !v)} className="flex items-center gap-1.5 text-[11px] font-mono text-amber-800 border border-amber-900/40 px-3 py-1.5 hover:bg-amber-950/20 transition-colors"><Plus className="w-3 h-3" /> Add Sleep</button>}
        </div>
        {showSleepInput && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
            <input type="number" step="0.5" min="0.5" max="24" value={sleepInput} onChange={e => setSleepInput(e.target.value)} placeholder="Hours (e.g. 2.5)" className="vault-input flex-1 text-sm" />
            <button onClick={addSleep} disabled={addingSleep} className="text-[11px] font-mono text-amber-200 bg-amber-950 border border-amber-900/60 px-4 py-2 hover:bg-amber-900 disabled:opacity-40 uppercase tracking-widest">{addingSleep ? '...' : 'Add'}</button>
          </div>
        )}
        {sleepLog.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1">
            {sleepLog.slice(0, 5).map(log => (
              <div key={log.id} className="flex justify-between text-[10px] font-mono text-zinc-600"><span>+{log.hours_added}h</span><span>{formatDateTime(log.logged_at)}</span></div>
            ))}
          </div>
        )}
      </div>
      <div className="border border-zinc-800 bg-zinc-950 p-5 space-y-5">
        {editing ? (
          <>
            <EditField label="Any Incidents" value={s.any_incidents ?? ''} onChange={v => setS(prev => ({ ...prev, any_incidents: v }))} />
            {canViewSensitive && <EditField label="Personal Reflection (sensitive)" value={s.personal_reflection ?? ''} onChange={v => setS(prev => ({ ...prev, personal_reflection: v }))} rows={6} />}
            <EditField label="Notes" value={s.notes ?? ''} onChange={v => setS(prev => ({ ...prev, notes: v }))} />
            <label className="flex items-center gap-3"><input type="checkbox" checked={s.is_sensitive} onChange={e => setS(prev => ({ ...prev, is_sensitive: e.target.checked }))} className="accent-red-800 w-4 h-4" /><span className="text-[11px] font-mono text-zinc-500">Mark as sensitive</span></label>
          </>
        ) : (
          <>{s.any_incidents && <ReadField label="Any Incidents">{s.any_incidents}</ReadField>}{canViewSensitive && s.personal_reflection && <ReadField label="Personal Reflection">{s.personal_reflection}</ReadField>}{s.notes && <ReadField label="Notes">{s.notes}</ReadField>}{s.is_sensitive && <span className="text-[9px] font-mono text-red-800 tracking-widest uppercase border border-red-900/30 px-2 py-0.5">Sensitive</span>}</>
        )}
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label><textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className="vault-input w-full resize-none" /></div>
}

function ReadField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><p className="text-[10px] tracking-widest text-zinc-600 uppercase font-mono">{label}</p><p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{children}</p></div>
}
