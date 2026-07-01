import type {
  FieldVisibilityLevel,
  IncidentFieldKey,
  IncidentFieldVisibility,
  MentalHealthIncident,
  Role,
} from './supabase/types'

export const REDACTED = 'REDACTED'

export const INCIDENT_FIELD_LABELS: Record<IncidentFieldKey, string> = {
  description: 'Incident details',
  notes: 'Notes',
  personal_notes: 'Private notes',
  professional_note: 'Note for counsellor and lawyer',
  location: 'Location',
  people_involved: 'Who was involved',
  outcome: "What's outcome",
}

export const DEFAULT_INCIDENT_FIELD_VISIBILITY: Record<IncidentFieldKey, FieldVisibilityLevel> = {
  description: 'viewer+',
  notes: 'viewer+',
  personal_notes: 'admin only',
  professional_note: 'lawyer+',
  location: 'viewer+',
  people_involved: 'viewer+',
  outcome: 'viewer+',
}

export const INCIDENT_VISIBILITY_OPTIONS: FieldVisibilityLevel[] = [
  'viewer+',
  'lawyer+',
  'counsellor+',
  'admin only',
]

export function incidentLabel(incident: Pick<MentalHealthIncident, 'incident_number' | 'id'>) {
  return incident.incident_number ? `Incident #${incident.incident_number}` : 'Incident'
}

export function normalizeIncidentVisibility(
  visibility: IncidentFieldVisibility | null | undefined,
  sensitiveFields: string[] = []
): Record<IncidentFieldKey, FieldVisibilityLevel> {
  const next = { ...DEFAULT_INCIDENT_FIELD_VISIBILITY, ...(visibility ?? {}) }

  for (const field of sensitiveFields) {
    if (field in next) next[field as IncidentFieldKey] = 'counsellor+'
  }

  return next
}

export function canViewVisibilityLevel(role: Role, level: FieldVisibilityLevel) {
  if (role === 'admin') return true
  if (level === 'viewer+') return true
  if (level === 'counsellor+') return role === 'counsellor'
  if (level === 'lawyer+') return role === 'lawyer'
  return false
}

export function canViewIncidentField(
  role: Role,
  incident: Pick<MentalHealthIncident, 'field_visibility' | 'sensitive_fields'>,
  field: IncidentFieldKey
) {
  const visibility = normalizeIncidentVisibility(incident.field_visibility, incident.sensitive_fields)
  return canViewVisibilityLevel(role, visibility[field])
}

export function visibleIncidentText(
  role: Role,
  incident: Pick<MentalHealthIncident, 'field_visibility' | 'sensitive_fields'>,
  field: IncidentFieldKey,
  value: string | null | undefined
) {
  const text = value?.trim()
  if (!text) return null
  return canViewIncidentField(role, incident, field) ? text : REDACTED
}

export function visibleIncidentList(
  role: Role,
  incident: Pick<MentalHealthIncident, 'field_visibility' | 'sensitive_fields'>,
  field: IncidentFieldKey,
  values: string[] | null | undefined
) {
  const clean = (values ?? []).map(v => v.trim()).filter(Boolean)
  if (!clean.length) return null
  return canViewIncidentField(role, incident, field) ? clean : REDACTED
}
