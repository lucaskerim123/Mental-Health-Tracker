'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function NewTrackerForm() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ date_start: today, any_incidents: '', personal_reflection: '', notes: '', is_sensitive: false })
  const [saving, setSaving] = useState(false)

  function set(field: string, value: unknown) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error, data } = await supabase.from('drug_tracker_sessions').insert({ ...form, user_id: user!.id, sleep_hours: 0 }).select().single()
    if (error) { toast.error('Failed: ' + error.message); setSaving(false); return }
    toast.success('Session started.')
    router.push(`/tracker/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Start Date"><input type="date" value={form.date_start} onChange={e => set('date_start', e.target.value)} className="vault-input" required /></Field>
      <Field label="Any Incidents"><textarea value={form.any_incidents} onChange={e => set('any_incidents', e.target.value)} rows={3} className="vault-input resize-none" /></Field>
      <Field label="Personal Reflection (sensitive)"><textarea value={form.personal_reflection} onChange={e => set('personal_reflection', e.target.value)} rows={5} placeholder="e.g. Missing her so much but thinking it's time to move on..." className="vault-input resize-none" /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="vault-input resize-none" /></Field>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.is_sensitive} onChange={e => set('is_sensitive', e.target.checked)} className="accent-red-800 w-4 h-4" />
        <span className="text-[11px] font-mono text-zinc-500 tracking-wide">Mark as sensitive</span>
      </label>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-zinc-500 border border-zinc-800 hover:border-zinc-700 uppercase">Cancel</button>
        <button type="submit" disabled={saving} className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-amber-200 bg-amber-950 border border-amber-900/60 hover:bg-amber-900 uppercase disabled:opacity-40">{saving ? 'Starting...' : 'Start Session'}</button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>{children}</div>
}
