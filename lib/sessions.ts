import type { DrugTrackerSession, FieldVisibilityLevel, Role, SessionFieldKey, SessionFieldVisibility } from '@/lib/supabase/types'

export const REDACTED = 'REDACTED'

export const SESSION_FIELD_LABELS: Record<SessionFieldKey, string> = {
  brief_notes: 'Brief notes',
  notes: 'Notes',
  usage_log: 'Usage log',
  counsellor_notes: 'Counsellor notes',
  lawyer_notes: 'Lawyer notes',
  private_notes: 'Private notes',
  mcp_outputs: 'Log entries',
}

export const DEFAULT_SESSION_FIELD_VISIBILITY: Record<SessionFieldKey, FieldVisibilityLevel> = {
  brief_notes: 'viewer+',
  notes: 'viewer+',
  usage_log: 'counsellor+',
  counsellor_notes: 'counsellor+',
  lawyer_notes: 'lawyer+',
  private_notes: 'admin only',
  mcp_outputs: 'admin only',
}

export const SESSION_VISIBILITY_OPTIONS: FieldVisibilityLevel[] = ['viewer+', 'counsellor+', 'lawyer+', 'admin only']

export function sessionLabel(session: Pick<DrugTrackerSession, 'session_number' | 'id'>) {
  return typeof session.session_number === 'number' ? `Session #${session.session_number}` : 'Session'
}

export function normalizeSessionVisibility(visibility: SessionFieldVisibility | null | undefined): Record<SessionFieldKey, FieldVisibilityLevel> {
  return {
    ...DEFAULT_SESSION_FIELD_VISIBILITY,
    ...(visibility ?? {}),
  }
}

export function canViewVisibilityLevel(role: Role, level: FieldVisibilityLevel) {
  if (role === 'admin') return true
  if (level === 'viewer+') return true
  if (level === 'counsellor+') return role === 'counsellor'
  if (level === 'lawyer+') return role === 'lawyer'
  return false
}

export function canViewSessionField(role: Role, session: Pick<DrugTrackerSession, 'field_visibility'>, field: SessionFieldKey) {
  const visibility = normalizeSessionVisibility(session.field_visibility)
  return canViewVisibilityLevel(role, visibility[field])
}

export function visibleSessionText(
  role: Role,
  session: Pick<DrugTrackerSession, 'field_visibility'>,
  field: SessionFieldKey,
  value: string | null | undefined,
) {
  if (!value) return null
  return canViewSessionField(role, session, field) ? value : REDACTED
}

export function isRestrictedSessionField(role: Role, session: Pick<DrugTrackerSession, 'field_visibility'>, field: SessionFieldKey) {
  return !canViewSessionField(role, session, field)
}
