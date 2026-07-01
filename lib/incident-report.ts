import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { incidentLabel, visibleIncidentList, visibleIncidentText } from '@/lib/incidents'
import { sessionLabel } from '@/lib/sessions'
import type { Document, MentalHealthIncident, Role } from '@/lib/supabase/types'

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

function canViewDocument(doc: Document, role: Role, userId: string) {
  return role === 'admin' || (!doc.is_sensitive && (!doc.allowed_user_ids.length || doc.allowed_user_ids.includes(userId)))
}

function asIncident(row: AnyRow): MentalHealthIncident {
  return row as MentalHealthIncident
}

export async function getIncidentReportData(incidentId: string, role: Role, userId: string) {
  const supabase = await createClient()
  const { data: incident } = await supabase.from('mental_health_incidents').select('*').eq('id', incidentId).single()
  if (!incident) return null

  const { data: trackerSession } = incident.tracker_session_id
    ? await supabase.from('drug_tracker_sessions').select('id, session_number, date_start, date_end').eq('id', incident.tracker_session_id).single()
    : { data: null }

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('attached_to_type', 'incident')
    .eq('attached_to_id', incidentId)
    .order('created_at', { ascending: true })

  return {
    incident,
    trackerSession: trackerSession ?? null,
    documents: documents ?? [],
    role,
    userId,
  }
}

export function renderIncidentReportHtml(report: NonNullable<Awaited<ReturnType<typeof getIncidentReportData>>>) {
  const { incident, trackerSession, documents, role, userId } = report
  const title = `${incidentLabel(incident)} - Incident Report`
  const generatedAt = new Date().toISOString()
  const visiblePeople = visibleIncidentList(role, incident, 'people_involved', incident.people_involved)
  const documentRows = (documents as Document[]).map((doc, index) => {
    const visible = canViewDocument(doc, role, userId)
    const label = `Document #${index + 1}`
    if (!visible) return `<article class="card"><p>${esc(`${label}: REDACTED`)}</p><small>${esc(formatDateTime(doc.created_at))}</small></article>`
    return `<article class="card"><p>${esc(`${label}: ${doc.filename}`)}</p><small>${esc(formatDateTime(doc.created_at))}${doc.is_sensitive ? ' · Sensitive' : ''}</small></article>`
  }).join('')

  const summary = section('Incident Summary', `
    <div class="grid">
      ${kv('Incident', incidentLabel(incident))}
      ${kv('Incident ID', incident.id)}
      ${kv('Occurred', formatDateTime(incident.occurred_at))}
      ${kv('Severity', incident.severity)}
      ${kv('Substance use', incident.substance_use ?? 'Not recorded')}
      ${kv('Police called', incident.police_called)}
      ${kv('Arrested', incident.was_arrested)}
      ${kv('Ambulance called', incident.ambulance_called)}
      ${kv('Sectioned', incident.was_sectioned)}
      ${kv('Linked session', trackerSession ? sessionLabel(trackerSession) : 'None')}
    </div>
  `)

  const detailBlock = section('Detailed Incident Details', `
    ${kv('Incident details', visibleIncidentText(role, incident, 'description', incident.description))}
    ${kv('Location', visibleIncidentText(role, incident, 'location', incident.location))}
    ${kv('Who was involved', visiblePeople)}
    ${kv('Notes', visibleIncidentText(role, incident, 'notes', incident.notes))}
    ${kv("What's outcome", visibleIncidentText(role, incident, 'outcome', incident.outcome))}
  `)

  const professionalBlock = section('Professional Notes', `
    ${kv('Note for counsellor and lawyer', visibleIncidentText(role, incident, 'professional_note', incident.professional_note))}
    ${kv('Private Notes', visibleIncidentText(role, incident, 'personal_notes', incident.personal_notes))}
  `)

  const docsBlock = documents.length ? section('Attached Documents', `
    <div class="stack">
      ${documentRows}
    </div>
  `) : empty('No attached documents.')

  const body = `
    <header class="report-header">
      <p class="eyebrow">Mental Health Incidents</p>
      <h1>${esc(title)}</h1>
      <p>Generated ${esc(formatDateTime(generatedAt))}</p>
    </header>
    ${summary}
    ${detailBlock}
    ${professionalBlock}
    ${docsBlock}
  `

  return { title, body }
}

export const reportStyles = `
  .report-document{background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;line-height:1.5;max-width:980px;margin:0 auto;padding:42px;box-shadow:0 0 0 1px rgba(255,255,255,.08)}
  .report-header{border-bottom:3px solid #111827;margin-bottom:28px;padding-bottom:18px}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.28em;color:#6b7280;margin:0 0 8px}.report-header h1{font-size:30px;line-height:1.1;margin:0 0 8px;color:#030712}.report-header p{margin:0;color:#4b5563}.report-section{break-inside:avoid;margin:0 0 24px}.report-section h2{font-size:16px;text-transform:uppercase;letter-spacing:.16em;border-bottom:1px solid #d1d5db;padding-bottom:7px;margin:0 0 12px;color:#111827}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px}.grid.small{font-size:13px}.kv{display:grid;grid-template-columns:170px 1fr;gap:10px;border-bottom:1px solid #e5e7eb;padding:6px 0}.kv strong{color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.kv span{white-space:pre-wrap;word-break:break-word}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;vertical-align:top}th{background:#f3f4f6;text-transform:uppercase;font-size:11px;letter-spacing:.08em;color:#374151}.stack{display:grid;gap:10px}.card{border:1px solid #d1d5db;background:#fafafa;padding:12px;break-inside:avoid}.card h3{font-size:14px;margin:0 0 8px}.card p{white-space:pre-wrap;margin:0 0 8px}.card small{color:#6b7280}.empty{color:#6b7280;font-style:italic}.no-print{font-family:monospace}@media print{body{background:#fff!important}.no-print{display:none!important}.report-document{box-shadow:none;max-width:none;padding:0}@page{margin:16mm}}
`
