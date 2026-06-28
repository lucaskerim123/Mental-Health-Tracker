'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { DEFAULT_SESSION_FIELD_VISIBILITY, normalizeSessionVisibility } from '@/lib/visibility'
import type { FieldVisibilityLevel, SessionFieldKey, SessionFieldVisibility } from '@/lib/supabase/types'

export default function NewTrackerForm() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date_start: today,
    brief_notes: '',
    counsellor_notes: '',
    lawyer_notes: '',
    personal_reflection: '',
    notes: '',
    is_sensitive: false,
  })
  const [fieldVisibility, setFieldVisibility] = useState<SessionFieldVisibility>(DEFAULT_SESSION_FIELD_VISIBILITY)
  const [saving, setSaving] = useState(false)

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setVisibility(field: SessionFieldKey, level: FieldVisibilityLevel) {
    setFieldVisibility(prev => ({ ...prev, [field]: level }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error, data } = await supabase.from('drug_tracker_sessions').insert({
      ...form,
      user_id: user!.id,
      sleep_hours: 0,
      field_visibility: normalizeSessionVisibility(fieldVisibility),
    }).select().single()

    if (error) { toast.error('Failed: ' + error.message); setSaving(false); return }
    toast.success('Session started.')
    router.push(`/tracker/${data.id}`)
  }

  const visibility = normalizeSessionVisibility(fieldVisibility)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Start Date">
        <input type="date" value={form.date_start} onChange={e => set('date_start', e.target.value)} className="vault-input" required />
      </Field>
      <LockableField label="Brief Notes" field="brief_notes" visibility={visibility} setVisibility={setVisibility}>
        <textarea value={form.brief_notes} onChange={e => set('brief_notes', e.target.value)} rows={3} className="vault-input resize-none" />
      </LockableField>
      <LockableField label="Notes" field="notes" visibility={visibility} setVisibility={setVisibility}>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="vault-input resize-none" />
      </LockableField>
      <LockableField label="Counsellor Notes" field="counsellor_notes" visibility={visibility} setVisibility={setVisibility}>
        <textarea value={form.counsellor_notes} onChange={e => set('counsellor_notes', e.target.value)} rows={4} className="vault-input resize-none" />
      </LockableField>
      <LockableField label="Lawyer Notes" field="lawyer_notes" visibility={visibility} setVisibility={setVisibility}>
        <textarea value={form.lawyer_notes} onChange={e => set('lawyer_notes', e.target.value)} rows={4} className="vault-input resize-none" />
      </LockableField>
      <LockableField label="Private Notes" field="private_notes" visibility={visibility} setVisibility={setVisibility}>
        <textarea value={form.personal_reflection} onChange={e => set('personal_reflection', e.target.value)} rows={5} className="vault-input resize-none" />
      </LockableField>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.is_sensitive} onChange={e => set('is_sensitive', e.target.checked)} className="accent-red-800 w-4 h-4" />
        <span className="text-[11px] font-mono text-zinc-500 tracking-wide">Mark as sensitive</span>
      </label>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-zinc-500 border border-zinc-800 hover:border-zinc-700 uppercase">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-amber-200 bg-amber-950 border border-amber-900/60 hover:bg-amber-900 uppercase disabled:opacity-40">
          {saving ? 'Starting...' : 'Start Session'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>{children}</div>
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
