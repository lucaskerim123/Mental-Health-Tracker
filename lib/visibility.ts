import type {
  DrugTrackerSession,
  FieldVisibilityLevel,
  IncidentFieldKey,
  IncidentFieldVisibility,
  MentalHealthIncident,
  Role,
  SessionFieldKey,
  SessionFieldVisibility,
} from '@/lib/supabase/types'

export const REDACTED = 'REDACTED'

export const INCIDENT_VISIBILITY_FIELDS: IncidentFieldKey[] = [
  'description',
  'notes',
  'personal_notes',
  'professional_note',
  'location',
  'people_involved',
  'outcome',
]

export const SESSION_VISIBILITY_FIELDS: SessionFieldKey[] = [
  'brief_notes',
  'notes',
  'usage_log',
  'counsellor_notes',
  'lawyer_notes',
  'private_notes',
  'mcp_outputs',
]

export const DEFAULT_INCIDENT_FIELD_VISIBILITY: Required<IncidentFieldVisibility> = {
  description: 'viewer+',
  notes: 'viewer+',
  personal_notes: 'counsellor+',
  professional_note: 'counsellor+',
  location: 'viewer+',
  people_involved: 'viewer+',
  outcome: 'viewer+',
}

export const DEFAULT_SESSION_FIELD_VISIBILITY: Required<SessionFieldVisibility> = {
  brief_notes: 'viewer+',
  notes: 'counsellor+',
  usage_log: 'counsellor+',
  counsellor_notes: 'counsellor+',
  lawyer_notes: 'lawyer+',
  private_notes: 'admin only',
  mcp_outputs: 'admin only',
}

const LEVELS: FieldVisibilityLevel[] = ['viewer+', 'counsellor+', 'lawyer+', 'admin only']

export function isVisibilityLevel(value: unknown): value is FieldVisibilityLevel {
  return typeof value === 'string' && LEVELS.includes(value as FieldVisibilityLevel)
}

export function incidentLabel(incident: Pick<MentalHealthIncident, 'id'> & { incident_number?: number | null }) {
  return incident.incident_number ? `Incident #${incident.incident_number}` : `Incident ${incident.id.slice(0, 8)}`
}

export function sessionLabel(session: Pick<DrugTrackerSession, 'id'> & { session_number?: number | null }) {
  return session.session_number ? `Session #${session.session_number}` : `Session ${session.id.slice(0, 8)}`
}

export function canViewVisibilityLevel(role: Role | string, level: FieldVisibilityLevel) {
  if (role === 'admin') return true
  if (level === 'viewer+') return role === 'viewer' || role === 'counsellor' || role === 'lawyer'
  if (level === 'counsellor+') return role === 'counsellor' || role === 'lawyer'
  if (level === 'lawyer+') return role === 'lawyer'
  return false
}

export function normalizeIncidentVisibility(value: unknown): Required<IncidentFieldVisibility> {
  const raw = typeof value === 'object' && value ? value as Record<string, unknown> : {}
  return Object.fromEntries(
    INCIDENT_VISIBILITY_FIELDS.map(field => {
      const candidate = raw[field]
      return [field, isVisibilityLevel(candidate) ? candidate : DEFAULT_INCIDENT_FIELD_VISIBILITY[field]]
    })
  ) as Required<IncidentFieldVisibility>
}

export function normalizeSessionVisibility(value: unknown): Required<SessionFieldVisibility> {
  const raw = typeof value === 'object' && value ? value as Record<string, unknown> : {}
  return Object.fromEntries(
    SESSION_VISIBILITY_FIELDS.map(field => {
      const candidate = raw[field]
      return [field, isVisibilityLevel(candidate) ? candidate : DEFAULT_SESSION_FIELD_VISIBILITY[field]]
    })
  ) as Required<SessionFieldVisibility>
}

export function canViewIncidentField(role: Role | string, incident: { field_visibility?: IncidentFieldVisibility | null }, field: IncidentFieldKey) {
  return canViewVisibilityLevel(role, normalizeIncidentVisibility(incident.field_visibility)[field])
}

export function canViewSessionField(role: Role | string, session: DrugTrackerSession, field: SessionFieldKey) {
  return canViewVisibilityLevel(role, normalizeSessionVisibility(session.field_visibility)[field])
}

export function visibleIncidentText(role: Role | string, incident: { field_visibility?: IncidentFieldVisibility | null }, field: IncidentFieldKey, value: string | null | undefined) {
  if (!value) return null
  return canViewIncidentField(role, incident, field) ? value : REDACTED
}

export function visibleSessionText(role: Role | string, session: DrugTrackerSession, field: SessionFieldKey, value: string | null | undefined) {
  if (!value) return null
  return canViewSessionField(role, session, field) ? value : REDACTED
}
