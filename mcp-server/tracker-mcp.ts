import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    for (const line of envFile.split('\n')) {
      const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const val = match[2].trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = val
      }
    }
  } catch {
    // rely on environment variables already set
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  process.stderr.write('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY\n')
  process.exit(1)
}

const BASE_HEADERS = {
  apikey: SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${SERVICE_ROLE_KEY!}`,
  'Content-Type': 'application/json',
}

async function dbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { headers: BASE_HEADERS })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function dbPost(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: { ...BASE_HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function dbPatch(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: { ...BASE_HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function getAdminUserId(): Promise<string> {
  const rows = await dbGet('/users?role=eq.admin&limit=1&select=id')
  if (!rows?.length) throw new Error('No admin user found in database')
  return rows[0].id
}

async function getActiveSession() {
  const rows = await dbGet(
    '/drug_tracker_sessions?date_end=is.null&order=created_at.desc&limit=1&select=id,date_start,sleep_hours,notes,any_incidents'
  )
  return rows?.[0] ?? null
}

const TOOLS = [
  {
    name: 'get_active_session',
    description: 'Get the current active tracker session (no date_end). Returns session id, start date, total sleep hours, and notes.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_tracker_sessions',
    description: 'List recent drug tracker sessions (last 10), with id, start date, end date, and sleep hours.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'start_session',
    description: 'Start a new drug tracker session with today as the start date.',
    inputSchema: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'Optional opening note for the session.' },
      },
    },
  },
  {
    name: 'end_session',
    description: 'Close the current active session by setting date_end to today.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_sleep',
    description: 'Add sleep hours to the active tracker session. Updates the running total and logs the addition in the audit trail.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Number of hours slept to add (e.g. 7.5)' },
        session_id: { type: 'string', description: 'Optional: specific session UUID. Defaults to current active session.' },
      },
      required: ['hours'],
    },
  },
  {
    name: 'update_session_note',
    description: 'Update the notes field on the active tracker session.',
    inputSchema: {
      type: 'object',
      properties: {
        notes: { type: 'string', description: 'New note content (replaces existing note).' },
        session_id: { type: 'string', description: 'Optional: specific session UUID. Defaults to active session.' },
      },
      required: ['notes'],
    },
  },
  {
    name: 'add_tracker_entry',
    description: 'Add a journal entry to a tracker session. If no session_id is given, targets the current active session.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The text content of the entry.' },
        session_id: { type: 'string', description: 'Optional: specific session UUID. Defaults to current active session.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'log_drug_use',
    description: 'Log a drug/substance use entry on the active tracker session.',
    inputSchema: {
      type: 'object',
      properties: {
        substance: { type: 'string', description: 'Name of the substance.' },
        amount: { type: 'number', description: 'Optional: numeric amount taken.' },
        unit: { type: 'string', description: 'Optional: unit (e.g. mg, g, ml, tabs).' },
        notes: { type: 'string', description: 'Optional: any additional notes.' },
        session_id: { type: 'string', description: 'Optional: specific session UUID. Defaults to active session.' },
      },
      required: ['substance'],
    },
  },
  {
    name: 'list_incidents',
    description: 'List recent mental health incidents (last 10), with id, date, severity, and description.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'log_incident',
    description: 'Log a new mental health incident.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'What happened.' },
        severity: { type: 'number', description: 'Severity 1-10 (1 = minimal, 10 = crisis).' },
        notes: { type: 'string', description: 'Optional: additional notes.' },
        substance_use: {
          type: 'string',
          enum: ['no', 'yes', 'comedown'],
          description: 'Optional: substance use context. Default "no".',
        },
        police_called: { type: 'boolean', description: 'Optional: whether police were called.' },
        ambulance_called: { type: 'boolean', description: 'Optional: whether ambulance was called.' },
        was_arrested: { type: 'boolean', description: 'Optional: whether arrested.' },
        was_sectioned: { type: 'boolean', description: 'Optional: whether sectioned.' },
        tracker_session_id: { type: 'string', description: 'Optional: UUID of a tracker session to link this incident to.' },
      },
      required: ['description', 'severity'],
    },
  },
]

const server = new Server(
  { name: 'mental-health-tracker', version: '2.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params

  if (name === 'get_active_session') {
    const session = await getActiveSession()
    if (!session) return text('No active tracker session.')
    return text(
      `Active session: ${session.id}\nStarted: ${session.date_start}\nSleep total: ${session.sleep_hours}h\nNotes: ${session.notes ?? '(none)'}`
    )
  }

  if (name === 'list_tracker_sessions') {
    const sessions = await dbGet(
      '/drug_tracker_sessions?select=id,date_start,date_end,sleep_hours,notes&order=created_at.desc&limit=10'
    ) as Array<{ id: string; date_start: string; date_end: string | null; sleep_hours: number; notes: string | null }>
    if (!sessions.length) return text('No sessions found.')
    const lines = sessions.map(s =>
      `${s.date_end ? '  ' : '→ '}[${s.id}] ${s.date_start}${s.date_end ? ` → ${s.date_end}` : ' (ongoing)'}  ${s.sleep_hours}h sleep${s.notes ? `  — ${s.notes}` : ''}`
    )
    return text(lines.join('\n'))
  }

  if (name === 'start_session') {
    const existing = await getActiveSession()
    if (existing) return text(`Session already active: ${existing.id} (started ${existing.date_start}). Close it first.`)
    const userId = await getAdminUserId()
    const today = new Date().toISOString().split('T')[0]
    const { notes } = args as { notes?: string }
    const [row] = await dbPost('/drug_tracker_sessions', {
      user_id: userId,
      date_start: today,
      sleep_hours: 0,
      notes: notes ?? '',
      any_incidents: '',
      personal_reflection: '',
      is_sensitive: false,
      sensitive_fields: [],
    })
    return text(`Session started.\nID: ${row.id}\nDate: ${today}`)
  }

  if (name === 'end_session') {
    const session = await getActiveSession()
    if (!session) return text('No active session to close.')
    const today = new Date().toISOString().split('T')[0]
    await dbPatch(`/drug_tracker_sessions?id=eq.${session.id}`, { date_end: today })
    return text(`Session ${session.id} closed. End date: ${today}`)
  }

  if (name === 'add_sleep') {
    const { hours, session_id } = args as { hours: number; session_id?: string }
    if (hours <= 0) return text('Hours must be greater than 0.')

    let sid = session_id
    let currentHours = 0
    if (!sid) {
      const session = await getActiveSession()
      if (!session) return text('No active session. Start one first or provide a session_id.')
      sid = session.id
      currentHours = Number(session.sleep_hours)
    } else {
      const rows = await dbGet(`/drug_tracker_sessions?id=eq.${sid}&select=id,sleep_hours`) as Array<{ id: string; sleep_hours: number }>
      if (!rows.length) return text(`Session ${sid} not found.`)
      currentHours = Number(rows[0].sleep_hours)
    }

    const newTotal = currentHours + hours
    await Promise.all([
      dbPost('/sleep_log', { session_id: sid, hours_added: hours }),
      dbPatch(`/drug_tracker_sessions?id=eq.${sid}`, { sleep_hours: newTotal }),
    ])
    return text(`+${hours}h sleep logged. New total: ${newTotal}h on session ${sid}`)
  }

  if (name === 'update_session_note') {
    const { notes, session_id } = args as { notes: string; session_id?: string }
    let sid = session_id
    if (!sid) {
      const session = await getActiveSession()
      if (!session) return text('No active session. Provide a session_id.')
      sid = session.id
    }
    await dbPatch(`/drug_tracker_sessions?id=eq.${sid}`, { notes })
    return text(`Note saved on session ${sid}.`)
  }

  if (name === 'add_tracker_entry') {
    const { content, session_id } = args as { content: string; session_id?: string }
    let sid = session_id
    if (!sid) {
      const session = await getActiveSession()
      if (!session) return text('No active session. Start one first or provide a session_id.')
      sid = session.id
    }
    const [entry] = await dbPost('/tracker_entries', { session_id: sid, content, source: 'mcp' })
    return text(`Entry saved.\nID: ${entry.id}\nSession: ${sid}\nTime: ${entry.created_at}\nContent: "${content}"`)
  }

  if (name === 'log_drug_use') {
    const { substance, amount, unit, notes, session_id } = args as {
      substance: string; amount?: number; unit?: string; notes?: string; session_id?: string
    }
    let sid = session_id
    if (!sid) {
      const session = await getActiveSession()
      if (!session) return text('No active session. Start one first or provide a session_id.')
      sid = session.id
    }
    const [entry] = await dbPost('/drug_use_log', {
      session_id: sid,
      substance,
      amount: amount ?? null,
      unit: unit ?? null,
      notes: notes ?? null,
    })
    return text(`Drug use logged.\nID: ${entry.id}\nSubstance: ${substance}${amount ? ` · ${amount}${unit ? unit : ''}` : ''}\nSession: ${sid}`)
  }

  if (name === 'list_incidents') {
    const incidents = await dbGet(
      '/mental_health_incidents?select=id,occurred_at,severity,description&order=occurred_at.desc&limit=10'
    ) as Array<{ id: string; occurred_at: string; severity: number; description: string }>
    if (!incidents.length) return text('No incidents found.')
    const lines = incidents.map(i =>
      `[${i.id}] SEV ${i.severity}  ${i.occurred_at.slice(0, 16).replace('T', ' ')}  — ${i.description.slice(0, 80)}`
    )
    return text(lines.join('\n'))
  }

  if (name === 'log_incident') {
    const {
      description, severity, notes, substance_use, police_called, ambulance_called,
      was_arrested, was_sectioned, tracker_session_id,
    } = args as {
      description: string; severity: number; notes?: string; substance_use?: string;
      police_called?: boolean; ambulance_called?: boolean; was_arrested?: boolean;
      was_sectioned?: boolean; tracker_session_id?: string;
    }
    if (severity < 1 || severity > 10) return text('Severity must be 1–10.')
    const userId = await getAdminUserId()
    const [incident] = await dbPost('/mental_health_incidents', {
      user_id: userId,
      description,
      severity,
      notes: notes ?? null,
      substance_use: substance_use ?? 'no',
      police_called: police_called ?? false,
      ambulance_called: ambulance_called ?? false,
      was_arrested: was_arrested ?? false,
      was_sectioned: was_sectioned ?? false,
      tracker_session_id: tracker_session_id ?? null,
      is_sensitive: false,
      sensitive_fields: [],
      people_involved: [],
    })
    return text(`Incident logged.\nID: ${incident.id}\nSeverity: ${severity}/10\nTime: ${incident.occurred_at}\nDescription: "${description}"`)
  }

  throw new Error(`Unknown tool: ${name}`)
})

function text(t: string) {
  return { content: [{ type: 'text' as const, text: t }] }
}

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  process.stderr.write(String(err) + '\n')
  process.exit(1)
})
