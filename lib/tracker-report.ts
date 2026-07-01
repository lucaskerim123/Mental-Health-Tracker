import { createClient } from '@/lib/supabase/server'
import { daysUp, formatDate, formatDateTime } from '@/lib/utils'
import { incidentLabel, visibleIncidentText } from '@/lib/incidents'
import { canViewVisibilityLevel, sessionLabel, visibleSessionText } from '@/lib/sessions'
import type { MentalHealthIncident, Role } from '@/lib/supabase/types'

type AnyRow = Record<string, any>

function text(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not recorded'
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None recorded'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function esc(value: unknown) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function section(title: string, body: string) {
  return `<section class="report-section"><h2>${esc(title)}</h2>${body}</section>`
}

function kv(label: string, value: unknown) {
  return `<div class="kv"><strong>${esc(label)}</strong><span>${esc(value)}</span></div>`
}

function empty(label: string) {
  return `<p class="empty">${esc(label)}</p>`
}

function eventLabel(event: AnyRow) {
  const original = event.event_type || event.entry_type || event.title || event.content || ''
  const raw = String(original).trim().toLowerCase()
  if (raw === 'start' || raw === 'session_start' || raw === 'sesh_start' || raw === 'start_session') return 'Sesh started'
  if (raw === 'stop' || raw === 'session_stop' || raw === 'sesh_stop' || raw === 'end' || raw === 'end_session' || raw === 'close_session') return 'Sesh stopped'
  if (raw.includes('mood')) return 'Mood entry'
  if (raw.includes('sleep')) return 'Sleep'
  if (raw.includes('note')) return 'Note'
  if (raw.includes('usage') || raw.includes('drug')) return 'Usage log'
  if (raw.includes('incident')) return 'Incident link'
  if (raw.includes('document') || raw.includes('attachment')) return 'Document link'
  if (raw.includes('edit') || raw.includes('update')) return 'Edited entry'
  if (raw.includes('link')) return 'Linked record'
  if (raw.includes('summary') || raw.includes('summarise') || raw.includes('summarize')) return 'Summary command'
  if (raw.includes('status') || raw.includes('check')) return 'Status check'
  return original || 'Session event'
}

function asIncident(row: AnyRow): MentalHealthIncident {
  return row as MentalHealthIncident
}

export async function getTrackerReportData(sessionId: string, role: Role) {
  const supabase = await createClient()
  const [
    { data: session },
    { data: sleepLog },
    { data: drugUseLog },
    { data: linkedIncidents },
    { data: entries },
    { data: sessionEvents },
    { data: sessionMoods },
    { data: sessionNotes },
  ] = await Promise.all([
    supabase.from('drug_tracker_sessions').select('*').eq('id', sessionId).single(),
    supabase.from('sleep_log').select('*').eq('session_id', sessionId).order('logged_at', { ascending: true }),
    supabase.from('drug_use_log').select('*').eq('session_id', sessionId).order('logged_at', { ascending: true }),
    supabase.from('mental_health_incidents').select('*').eq('tracker_session_id', sessionId).order('occurred_at', { ascending: true }),
    supabase.from('tracker_entries').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
    supabase.from('session_events').select('*').eq('session_id', sessionId).order('occurred_at', { ascending: true }),
    supabase.from('session_moods').select('*').eq('session_id', sessionId).order('occurred_at', { ascending: true }),
    supabase.from('session_notes').select('*').eq('session_id', sessionId).order('occurred_at', { ascending: true }),
  ])

  if (!session) return null

  const canViewSensitive = role !== 'viewer'
  const safeSession = canViewSensitive ? session : {
    ...session,
    personal_reflection: null,
    ...(session.is_sensitive ? { notes: null } : {}),
    ...Object.fromEntries((session.sensitive_fields ?? []).map((f: string) => [f, null])),
  }

  const visibleNotes = ((sessionNotes ?? []) as AnyRow[]).filter(n => canViewVisibilityLevel(role, n.visibility ?? 'viewer+'))
  const visibleEntries = ((entries ?? []) as AnyRow[]).filter(e => canViewVisibilityLevel(role, e.visibility ?? 'viewer+'))

  return {
    session: safeSession,
    sleepLog: sleepLog ?? [],
    drugUseLog: drugUseLog ?? [],
    linkedIncidents: linkedIncidents ?? [],
    entries: visibleEntries,
    sessionEvents: sessionEvents ?? [],
    sessionMoods: sessionMoods ?? [],
    sessionNotes: visibleNotes,
    role,
    canViewSensitive,
  }
}

export function renderTrackerReportHtml(report: NonNullable<Awaited<ReturnType<typeof getTrackerReportData>>>) {
  const { session, sleepLog, drugUseLog, linkedIncidents, entries, sessionEvents, sessionMoods, sessionNotes, role } = report
  const title = `${sessionLabel(session)} — Full Session Report`
  const generatedAt = new Date().toISOString()

  const summary = section('Session Summary', `
    <div class="grid">
      ${kv('Session', sessionLabel(session))}
      ${kv('Session ID', session.id)}
      ${kv('Started', formatDate(session.date_start))}
      ${kv('Ended', session.date_end ? formatDate(session.date_end) : 'Open / ongoing')}
      ${kv('Total days', `Day ${daysUp(session.date_start, session.date_end)}`)}
      ${kv('Total sleep recorded', `${session.sleep_hours ?? 0}h`)}
      ${kv('Linked incidents', linkedIncidents.length)}
      ${kv('Sensitive session', session.is_sensitive)}
    </div>
  `)

  const sessionNotesBlock = section('Main Session Notes', `
    ${kv('Brief notes', visibleSessionText(role, session, 'brief_notes', session.brief_notes))}
    ${kv('General notes', visibleSessionText(role, session, 'notes', session.notes))}
    ${kv('Personal reflection', visibleSessionText(role, session, 'private_notes', session.personal_reflection))}
    ${kv('Counsellor notes', visibleSessionText(role, session, 'counsellor_notes', session.counsellor_notes))}
    ${kv('Lawyer notes', visibleSessionText(role, session, 'lawyer_notes', session.lawyer_notes))}
    ${kv('Any incidents field', session.any_incidents)}
  `)

  const sleepBlock = section('Sleep Log', sleepLog.length ? `
    <table><thead><tr><th>Time logged</th><th>Hours added</th></tr></thead><tbody>
      ${sleepLog.map((log: AnyRow) => `<tr><td>${esc(formatDateTime(log.logged_at))}</td><td>${esc(`${log.hours_added}h`)}</td></tr>`).join('')}
    </tbody></table>
  ` : empty('No sleep log entries recorded.'))

  const usageBlock = section('Usage Log', drugUseLog.length ? `
    <table><thead><tr><th>Time logged</th><th>Substance</th><th>Amount</th><th>Notes</th></tr></thead><tbody>
      ${drugUseLog.map((log: AnyRow) => `<tr><td>${esc(formatDateTime(log.logged_at))}</td><td>${esc(log.substance)}</td><td>${esc(log.amount != null ? `${log.amount} ${log.unit ?? ''}`.trim() : 'Not recorded')}</td><td>${esc(log.notes)}</td></tr>`).join('')}
    </tbody></table>
  ` : empty('No usage entries recorded.'))

  const moodsBlock = section('Mood Entries', sessionMoods.length ? `
    <table><thead><tr><th>Time</th><th>Mood</th><th>Notes</th></tr></thead><tbody>
      ${sessionMoods.map((mood: AnyRow) => `<tr><td>${esc(formatDateTime(mood.occurred_at))}</td><td>${esc(mood.mood)}</td><td>${esc(mood.notes)}</td></tr>`).join('')}
    </tbody></table>
  ` : empty('No mood entries recorded.'))

  const notesBlock = section('Note Entries', sessionNotes.length ? `
    <div class="stack">
      ${sessionNotes.map((note: AnyRow) => `<article class="card"><p>${esc(note.content ?? note.note)}</p><small>${esc(note.visibility ?? 'viewer+')} · ${esc(formatDateTime(note.occurred_at))}</small></article>`).join('')}
    </div>
  ` : empty('No visible note entries recorded.'))

  const entriesBlock = section('Tracker Entries', entries.length ? `
    <div class="stack">
      ${entries.map((entry: AnyRow) => `<article class="card"><p>${esc(entry.content)}</p><small>${esc(entry.entry_type ?? 'entry')} · ${esc(entry.source ?? 'unknown')} · ${esc(formatDateTime(entry.created_at))}</small></article>`).join('')}
    </div>
  ` : empty('No tracker entries recorded.'))

  const eventsBlock = section('Session Timeline / Events', sessionEvents.length ? `
    <table><thead><tr><th>Time</th><th>Event</th><th>Details</th></tr></thead><tbody>
      ${sessionEvents.map((event: AnyRow) => `<tr><td>${esc(formatDateTime(event.occurred_at))}</td><td>${esc(eventLabel(event))}</td><td>${esc(event.content ?? event.title ?? event.entry_type ?? event.event_type)}</td></tr>`).join('')}
    </tbody></table>
  ` : empty('No session events recorded.'))

  const incidentsBlock = section('Connected Incidents', linkedIncidents.length ? `
    <div class="stack">
      ${linkedIncidents.map((incident: AnyRow) => `<article class="card incident"><h3>${esc(incidentLabel(asIncident(incident)))}</h3><div class="grid small">${kv('Occurred', formatDateTime(incident.occurred_at))}${kv('Severity', incident.severity)}${kv('Police called', incident.police_called)}${kv('Ambulance called', incident.ambulance_called)}${kv('Arrested', incident.was_arrested)}${kv('Sectioned', incident.was_sectioned)}</div><p>${esc(visibleIncidentText(role, asIncident(incident), 'description', incident.description))}</p></article>`).join('')}
    </div>
  ` : empty('No incidents linked to this session.'))

  const body = `
    <header class="report-header">
      <p class="eyebrow">Mental Health Tracker</p>
      <h1>${esc(title)}</h1>
      <p>Generated ${esc(formatDateTime(generatedAt))}</p>
    </header>
    ${summary}
    ${sleepBlock}
    ${sessionNotesBlock}
    ${moodsBlock}
    ${usageBlock}
    ${notesBlock}
    ${incidentsBlock}
    ${entriesBlock}
    ${eventsBlock}
  `

  return { title, body }
}

export const reportStyles = `
  .report-document{background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;line-height:1.5;max-width:980px;margin:0 auto;padding:42px;box-shadow:0 0 0 1px rgba(255,255,255,.08)}
  .report-header{border-bottom:3px solid #111827;margin-bottom:28px;padding-bottom:18px}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.28em;color:#6b7280;margin:0 0 8px}.report-header h1{font-size:30px;line-height:1.1;margin:0 0 8px;color:#030712}.report-header p{margin:0;color:#4b5563}.report-section{break-inside:avoid;margin:0 0 24px}.report-section h2{font-size:16px;text-transform:uppercase;letter-spacing:.16em;border-bottom:1px solid #d1d5db;padding-bottom:7px;margin:0 0 12px;color:#111827}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px}.grid.small{font-size:13px}.kv{display:grid;grid-template-columns:170px 1fr;gap:10px;border-bottom:1px solid #e5e7eb;padding:6px 0}.kv strong{color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.kv span{white-space:pre-wrap;word-break:break-word}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;vertical-align:top}th{background:#f3f4f6;text-transform:uppercase;font-size:11px;letter-spacing:.08em;color:#374151}.stack{display:grid;gap:10px}.card{border:1px solid #d1d5db;background:#fafafa;padding:12px;break-inside:avoid}.card h3{font-size:14px;margin:0 0 8px}.card p{white-space:pre-wrap;margin:0 0 8px}.card small{color:#6b7280}.empty{color:#6b7280;font-style:italic}.no-print{font-family:monospace}@media print{body{background:#fff!important}.no-print{display:none!important}.report-document{box-shadow:none;max-width:none;padding:0}@page{margin:16mm}}
`
