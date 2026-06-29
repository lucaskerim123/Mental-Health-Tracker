'use client'

import type { FieldVisibilityLevel } from '@/lib/supabase/types'

export const GLOBAL_PERMISSION_OPTIONS: FieldVisibilityLevel[] = [
  'viewer+',
  'lawyer+',
  'counsellor+',
  'admin only',
]

type Props = {
  label?: string
  value: FieldVisibilityLevel
  onChange: (value: FieldVisibilityLevel) => void
  options?: FieldVisibilityLevel[]
  className?: string
}

export default function PermissionSelector({
  label = 'Permission',
  value,
  onChange,
  options = GLOBAL_PERMISSION_OPTIONS,
  className = '',
}: Props) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="section-label">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as FieldVisibilityLevel)}
        className="vault-input text-sm"
      >
        {options.map(option => (
          <option key={option} value={option}>{permissionLabel(option)}</option>
        ))}
      </select>
    </div>
  )
}

export function permissionLabel(value: FieldVisibilityLevel) {
  if (value === 'viewer+') return 'Viewers+'
  if (value === 'lawyer+') return 'Lawyers+'
  if (value === 'counsellor+') return 'Counsellors+'
  return 'Admins only'
}
