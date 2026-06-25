'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'

export default function NewIncidentForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    occurred_at: new Date().toISOString().slice(0, 16),
    severity: 5,
    description: '',
    personal_notes: '',
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
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error, data } = await supabase.from('mental_health_incidents').insert({
      ...form,
      user_id: user!.id,
      sensitive_fields: sensitiveFields,
    }).select().single()

    if (error) { toast.error('Failed to save: ' + error.message); setSaving(false); return }
    toast.success('Incident recorded.')
    router.push(`/incidents/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Date & Time">
        <input
          type="datetime-local"
          value={form.occurred_at}
          onChange={e => set('occurred_at', e.target.value)}
          className="vault-input"
          required
        />
      </Field>

      <Field label={`Severity: ${form.severity}/10`}>
        <input
          type="range" min={1} max={10}
          value={form.severity}
          onChange={e => set('severity', Number(e.target.value))}
          className="w-full accent-red-800"
        />
        <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
          <span>1 minimal</span><span>10 crisis</span>
        </div>
      </Field>

      <LockableField label="Description" field="description" isSensitive={isSensitive} toggle={toggleSensitiveField}>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={3}
          className="vault-input resize-none"
          required
        />
      </LockableField>

      <Field label="Personal Notes (always restricted to counsellors+)">
        <textarea
          value={form.personal_notes}
          onChange={e => set('personal_notes', e.target.value)}
          rows={4}
          placeholder="Private reflections — visible to counsellors only"
          className="vault-input resize-none"
        />
      </Field>

      <LockableField label="General Notes" field="notes" isSensitive={isSensitive} toggle={toggleSensitiveField}>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          className="vault-input resize-none"
        />
      </LockableField>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_sensitive}
          onChange={e => set('is_sensitive', e.target.checked)}
          className="accent-red-800 w-4 h-4"
        />
        <span className="text-[11px] font-mono text-zinc-500 tracking-wide">Mark entire entry as sensitive (hides from viewers)</span>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-zinc-500 border border-zinc-800 hover:border-zinc-700 uppercase transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-[11px] font-mono tracking-widest text-red-200 bg-red-950 border border-red-900/60 hover:bg-red-900 uppercase transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Record Incident'}
        </button>
      </div>
    </form>
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

function LockableField({
  label, field, isSensitive, toggle, children,
}: {
  label: string
  field: string
  isSensitive: (f: string) => boolean
  toggle: (f: string) => void
  children: React.ReactNode
}) {
  const locked = isSensitive(field)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] tracking-widest text-zinc-500 uppercase font-mono">{label}</label>
        <button
          type="button"
          onClick={() => toggle(field)}
          title={locked ? 'Restricted to counsellors+ — click to unrestrict' : 'Click to restrict to counsellors+'}
          className={`p-0.5 transition-colors ${locked ? 'text-red-700' : 'text-zinc-700 hover:text-zinc-500'}`}
        >
          <Lock className="w-3 h-3" />
        </button>
      </div>
      {children}
    </div>
  )
}
