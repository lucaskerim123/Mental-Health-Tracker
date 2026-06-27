export type Role = 'admin' | 'counsellor' | 'viewer'
export type Resource = 'incidents' | 'tracker' | 'documents' | 'users' | 'admin'
export type Action = 'view' | 'view_sensitive' | 'create' | 'edit' | 'delete' | 'manage_users' | 'manage_invites'

export interface UserProfile {
  id: string
  display_name: string
  role: Role
  created_at: string
}

export interface Invite {
  id: string
  token: string
  created_by: string
  used_by: string | null
  role_to_assign: Role
  expires_at: string
  created_at: string
}

export interface MentalHealthIncident {
  id: string
  user_id: string
  occurred_at: string
  severity: number
  description: string
  is_sensitive: boolean
  sensitive_fields: string[]
  personal_notes: string | null
  notes: string | null
  names_involved: string | null
  substance_use: 'no' | 'yes' | 'comedown' | null
  emergency_services: boolean
  police_called: boolean
  ambulance_called: boolean
  was_arrested: boolean
  was_sectioned: boolean
  people_involved: string[]
  tracker_session_id: string | null
  created_at: string
}

export interface DrugTrackerSession {
  id: string
  user_id: string
  date_start: string
  date_end: string | null
  sleep_hours: number
  any_incidents: string | null
  personal_reflection: string | null
  notes: string | null
  is_sensitive: boolean
  sensitive_fields: string[]
  created_at: string
}

export interface SleepLog {
  id: string
  session_id: string
  hours_added: number
  logged_at: string
}

export interface Document {
  id: string
  uploaded_by: string
  filename: string
  storage_path: string
  mime_type: string
  is_sensitive: boolean
  allowed_user_ids: string[]
  attached_to_type: 'incident' | 'tracker_session' | 'none'
  attached_to_id: string | null
  created_at: string
}

export interface Permission {
  id: string
  user_id: string
  resource: Resource
  action: Action
  granted: boolean
}

// Role-based defaults (checked when no override row exists)
export const ROLE_DEFAULTS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  admin: {
    incidents: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
    tracker: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
    documents: ['view', 'view_sensitive', 'create', 'edit', 'delete'],
    users: ['manage_users', 'manage_invites'],
    admin: ['view'],
  },
  counsellor: {
    incidents: ['view', 'view_sensitive'],
    tracker: ['view', 'view_sensitive'],
    documents: ['view', 'view_sensitive'],
  },
  viewer: {
    incidents: ['view'],
    tracker: ['view'],
    documents: ['view'],
  },
}
