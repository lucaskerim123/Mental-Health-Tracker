export type Role = 'admin' | 'lawyer' | 'counsellor' | 'viewer'
export type Resource = 'incidents' | 'tracker' | 'documents' | 'users' | 'admin'
export type Action = 'view' | 'view_sensitive' | 'create' | 'edit' | 'delete' | 'manage_users' | 'manage_invites'
export type FieldVisibilityLevel = 'viewer+' | 'counsellor+' | 'lawyer+' | 'admin only'
export type IncidentFieldKey =
  | 'description'
  | 'notes'
  | 'personal_notes'
  | 'professional_note'
  | 'location'
  | 'people_involved'
  | 'outcome'
export type IncidentFieldVisibility = Partial<Record<IncidentFieldKey, FieldVisibilityLevel>>
export type SessionFieldKey =
  | 'brief_notes'
  | 'notes'
  | 'usage_log'
  | 'counsellor_notes'
  | 'lawyer_notes'
  | 'private_notes'
  | 'mcp_outputs'
export type SessionFieldVisibility = Partial<Record<SessionFieldKey, FieldVisibilityLevel>>

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
  incident_number: number | null
  user_id: string
  occurred_at: string
  severity: number
  description: string
  is_sensitive: boolean
  sensitive_fields: string[]
  field_visibility: IncidentFieldVisibility | null
  personal_notes: string | null
  notes: string | null
  location: string | null
  outcome: string | null
  professional_note: string | null
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
  session_number: number | null
  user_id: string
  date_start: string
  date_end: string | null
  sleep_hours: number
  any_incidents: string | null
  brief_notes: string | null
  counsellor_notes: string | null
  lawyer_notes: string | null
  field_visibility: SessionFieldVisibility | null
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

export interface DrugUseLog {
  id: string
  session_id: string
  substance: string
  amount: number | null
  unit: string | null
  notes: string | null
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

export interface Ban {
  id: string
  type: 'user' | 'ip'
  value: string
  reason: string | null
  created_by: string | null
  expires_at: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string | null
  display_name: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface TrackerEntry {
  id: string
  session_id: string
  content: string
  source: string
  entry_type?: string | null
  visibility?: FieldVisibilityLevel | null
  metadata?: Record<string, unknown> | null
  incident_id?: string | null
  created_at: string
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
  lawyer: {
    incidents: ['view', 'view_sensitive'],
    tracker: ['view', 'view_sensitive'],
    documents: ['view', 'view_sensitive'],
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
