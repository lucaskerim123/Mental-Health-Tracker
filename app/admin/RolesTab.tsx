'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Save, Shield } from 'lucide-react'
import type { Action, Resource, Role } from '@/lib/supabase/types'
import {
  ACTION_LABELS,
  cloneRolePermissions,
  normalizeRolePermissions,
  ROLE_PERMISSION_EDITABLE_ROLES,
  ROLE_PERMISSION_ACTIONS,
  ROLE_PERMISSION_RESOURCES,
  RESOURCE_LABELS,
  type RolePermissionsMatrix,
} from '@/lib/role-permissions'

interface Props {
  initialRolePermissions: RolePermissionsMatrix
}

export default function RolesTab({ initialRolePermissions }: Props) {
  const baseDefaults = useMemo(() => normalizeRolePermissions(null), [])
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMatrix>(cloneRolePermissions(initialRolePermissions))
  const [selectedRole, setSelectedRole] = useState<Role>('viewer')
  const [saving, setSaving] = useState(false)

  const current = rolePermissions[selectedRole]
  const activeCount = ROLE_PERMISSION_RESOURCES.reduce(
    (sum, resource) => sum + (current[resource]?.length ?? 0),
    0,
  )

  function updateRole(next: Partial<Record<Resource, Action[]>>) {
    setRolePermissions(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        ...next,
      },
    }))
  }

  function toggleAction(resource: Resource, action: Action) {
    const currentActions = current[resource] ?? []
    const nextActions = currentActions.includes(action)
      ? currentActions.filter(existing => existing !== action)
      : [...currentActions, action]
    updateRole({ [resource]: nextActions })
  }

  function setAll(resource: Resource, granted: boolean) {
    updateRole({ [resource]: granted ? [...ROLE_PERMISSION_ACTIONS[resource]] : [] })
  }

  function resetRole() {
    setRolePermissions(prev => ({
      ...prev,
      [selectedRole]: cloneRolePermissions(baseDefaults)[selectedRole],
    }))
    toast.success(`${selectedRole} reset to app defaults.`)
  }

  async function saveRole() {
    setSaving(true)
    const res = await fetch('/api/admin/role-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: selectedRole, permissions: current }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error || 'Failed to save role permissions'); return }
    setRolePermissions(data.role_permissions)
    toast.success(`${selectedRole} permissions saved.`)
  }

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mb-4">Role Defaults</p>
        <div className="flex flex-wrap gap-2">
          {ROLE_PERMISSION_EDITABLE_ROLES.map(role => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase border transition-colors ${selectedRole === role ? 'border-zinc-400 text-zinc-200 bg-zinc-900' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
            >
              {role}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-mono text-zinc-700">
          Edit the baseline permissions for the selected role. Per-user overrides still win over these defaults.
        </p>
      </div>

      <div className="border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">{selectedRole} permissions</p>
            <p className="text-[10px] font-mono text-zinc-700 mt-1">{activeCount} active grant{activeCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={resetRole} className="flex items-center gap-2 px-3 py-2 border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 text-[10px] font-mono tracking-widest uppercase transition-colors">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <button type="button" onClick={saveRole} disabled={saving} className="flex items-center gap-2 px-3 py-2 border border-green-900/50 text-green-700 hover:border-green-700 text-[10px] font-mono tracking-widest uppercase transition-colors disabled:opacity-40">
              <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save role'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {ROLE_PERMISSION_RESOURCES.map(resource => (
            <div key={resource} className="border border-zinc-800 bg-black/40 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">{RESOURCE_LABELS[resource]}</p>
                  <p className="mt-1 text-[10px] font-mono text-zinc-700">{ROLE_PERMISSION_ACTIONS[resource].length} permission toggle{ROLE_PERMISSION_ACTIONS[resource].length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAll(resource, true)} className="text-[9px] font-mono tracking-widest uppercase px-2 py-1 border border-green-900/30 text-green-800 hover:border-green-700 transition-colors">Grant all</button>
                  <button type="button" onClick={() => setAll(resource, false)} className="text-[9px] font-mono tracking-widest uppercase px-2 py-1 border border-red-900/30 text-red-800 hover:border-red-700 transition-colors">Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLE_PERMISSION_ACTIONS[resource].map(action => {
                  const active = current[resource]?.includes(action) ?? false
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => toggleAction(resource, action)}
                      className={`px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase border transition-colors ${active ? 'border-green-800 bg-green-950/30 text-green-700' : 'border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'}`}
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
