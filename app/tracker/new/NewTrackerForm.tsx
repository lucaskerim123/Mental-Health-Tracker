'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'

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
  const [sensitiveFields, setSensitiveFields] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        sensitive_fields: sensitiveFields,
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) { toast.error('Failed: ' + (data?.error ?? 'Unknown error')); setSaving(false); return }
    toast.success('Session started.')
    router.push(`/tracker/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Start Date</label>
        <input type="date" value={form.date_start} onChange={e => set('date_start', e.target.value)} className="vault-input" required />
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Brief Notes</label>
        <textarea value={form.brief_notes} onChange={e => set('brief_notes', e.target.value)} rows={3} className="vault-input resize-none" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">Personal Reflection (always restricted to counsellors+)</label>
        <textarea value={form.personal_reflection} onChange={e => set('personal_reflection', e.target.value)} rows={5} placeholder="Private reflections — visible to counsellors only" className="vault-input resize-none" />
      </div>
      <LockableField label="Notes" field="notes" isSensitive={isSensitive} toggle={toggleSensitiveField}>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="vault-input resize-none" />
      </LockableField>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.is_sensitive} onChange={e => set('is_sensitive', e.target.checked)} className="accent-red-800 w-4 h-4" />
        <span className="text-[11px] font-mono text-zinc-500 tracking-wide">Mark as sensitive (hides entire session from viewers)</span>
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

function LockableField({ label, field, isSensitive, toggle, children }: {
  label: string; field: string; isSensitive: (f: string) => boolean; toggle: (f: string) => void; children: React.ReactNode
}) {
  const locked = isSensitive(field)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>
        <button type="button" onClick={() => toggle(field)}
          title={locked ? 'Restricted to counsellors+ — click to unrestrict' : 'Click to restrict to counsellors+'}
          className={`p-0.5 transition-colors ${locked ? 'text-red-700' : 'text-zinc-700 hover:text-zinc-500'}`}>
          <Lock className="w-3 h-3" />
        </button>
      </div>
      {children}
    </div>
  )
}
