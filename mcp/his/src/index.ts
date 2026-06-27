#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const SERVER_NAME = 'mental-health-incident-system'
const VERSION = '0.2.0'
const SESSION_TABLE = 'drug_tracker_sessions'

type DrugTrackerSession = {
  id: string
  user_id: string
  date_start: string
  date_end: string | null
  sleep_hours: number | null
  any_incidents: string | null
  personal_reflection: string | null
  notes: string | null
  is_sensitive: boolean | null
  created_at: string | null
  sensitive_fields: unknown
}

type HisEventType = 'START' | 'RESUME' | 'PAUSE' | 'STOP' | 'NOTE' | 'MOOD'

type HisEvent = {
  type: HisEventType
  at: string
  text: string
}

function getRequiredEnv(name: string) {
  const value = process.env[name]

  if (!value || !value.trim()) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

const supabase = getSupabase()
const hisUserId = getRequiredEnv('HIS_USER_ID')

const server = new McpServer({
  name: SERVER_NAME,
  version: VERSION,
})

function text(content: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: content,
      },
    ],
  }
}

function nowIso() {
  return new Date().toISOString()
}

function parseOptionalDatetime(datetime?: string) {
  if (!datetime || !datetime.trim()) return nowIso()

  const parsed = new Date(datetime)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime: ${datetime}. Use ISO format, e.g. 2026-06-27T21:30:00+10:00.`)
  }

  return parsed.toISOString()
}

function isoToDateOnly(iso: string) {
  return iso.slice(0, 10)
}

function dateOnlyToIso(date: string | null | undefined) {
  if (!date) return null

  if (date.includes('T')) return new Date(date).toISOString()

  return new Date(`${date}T00:00:00.000Z`).toISOString()
}

function formatSydney(iso: string | null | undefined) {
  if (!iso) return 'none'

  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function msToHuman(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function makeHisLine(type: HisEventType, at: string, body?: string) {
  const safeBody = (body ?? '').replace(/\r?\n/g, ' ').trim()
  return safeBody ? `[HIS:${type}] ${at} :: ${safeBody}` : `[HIS:${type}] ${at}`
}

function appendHisLine(notes: string | null | undefined, type: HisEventType, at: string, body?: string) {
  const existing = (notes ?? '').trimEnd()
  const line = makeHisLine(type, at, body)

  return existing ? `${existing}\n${line}` : line
}

function parseHisEvents(notes: string | null | undefined): HisEvent[] {
  const events: HisEvent[] = []
  const source = notes ?? ''
  const pattern = /^\[HIS:(START|RESUME|PAUSE|STOP|NOTE|MOOD)\]\s+([^:\n]+(?::[^:\n]+)*)(?:\s+::\s*(.*))?$/gm

  for (const match of source.matchAll(pattern)) {
    const type = match[1] as HisEventType
    const atRaw = (match[2] ?? '').trim()
    const parsed = new Date(atRaw)

    if (Number.isNaN(parsed.getTime())) continue

    events.push({
      type,
      at: parsed.toISOString(),
      text: (match[3] ?? '').trim(),
    })
  }

  return events
}

function getStartIso(session: DrugTrackerSession, events = parseHisEvents(session.notes)) {
  const startEvent = events.find((event) => event.type === 'START')

  return (
    startEvent?.at ??
    (session.created_at ? new Date(session.created_at).toISOString() : null) ??
    dateOnlyToIso(session.date_start) ??
    nowIso()
  )
}

function getLastStatus(session: DrugTrackerSession, events = parseHisEvents(session.notes)) {
  const statusEvents = events.filter((event) =>
    ['START', 'RESUME', 'PAUSE', 'STOP'].includes(event.type),
  )

  const last = statusEvents.at(-1)

  if (session.date_end || last?.type === 'STOP') return 'stopped'
  if (last?.type === 'PAUSE') return 'paused'
  return 'active'
}

function getLastMood(events: HisEvent[]) {
  return events.filter((event) => event.type === 'MOOD').at(-1)?.text ?? 'none'
}

function activeDurationMs(session: DrugTrackerSession) {
  const events = parseHisEvents(session.notes)
  const startIso = getStartIso(session, events)
  const status = getLastStatus(session, events)

  let endMs = Date.now()

  const stopEvent = events.filter((event) => event.type === 'STOP').at(-1)
  const pauseEvent = events.filter((event) => event.type === 'PAUSE').at(-1)

  if (status === 'stopped') {
    endMs = stopEvent ? Date.parse(stopEvent.at) : Date.parse(dateOnlyToIso(session.date_end) ?? nowIso())
  } else if (status === 'paused' && pauseEvent) {
    endMs = Date.parse(pauseEvent.at)
  }

  let pausedMs = 0
  let openPauseAt: number | null = null

  for (const event of events) {
    if (event.type === 'PAUSE') {
      openPauseAt = Date.parse(event.at)
    }

    if (event.type === 'RESUME' && openPauseAt !== null) {
      pausedMs += Math.max(0, Date.parse(event.at) - openPauseAt)
      openPauseAt = null
    }

    if (event.type === 'STOP' && openPauseAt !== null) {
      pausedMs += Math.max(0, Date.parse(event.at) - openPauseAt)
      openPauseAt = null
    }
  }

  return Math.max(0, endMs - Date.parse(startIso) - pausedMs)
}

async function getCurrentSession() {
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('user_id', hisUserId)
    .is('date_end', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data as DrugTrackerSession | null
}

async function getLatestSession() {
  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .select('*')
    .eq('user_id', hisUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data as DrugTrackerSession | null
}

async function appendToSession(session: DrugTrackerSession, type: HisEventType, body?: string, at = nowIso()) {
  const nextNotes = appendHisLine(session.notes, type, at, body)

  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .update({
      notes: nextNotes,
    })
    .eq('id', session.id)
    .select('*')
    .single()

  if (error) throw error

  return data as DrugTrackerSession
}

async function stopSession(session: DrugTrackerSession, at = nowIso()) {
  const nextNotes = appendHisLine(session.notes, 'STOP', at, 'Session stopped.')

  const { data, error } = await supabase
    .from(SESSION_TABLE)
    .update({
      date_end: isoToDateOnly(at),
      notes: nextNotes,
    })
    .eq('id', session.id)
    .select('*')
    .single()

  if (error) throw error

  return data as DrugTrackerSession
}

function countHisEntries(session: DrugTrackerSession) {
  return parseHisEvents(session.notes).length
}

function eventSummary(session: DrugTrackerSession, limit = 5) {
  const events = parseHisEvents(session.notes).slice(-limit).reverse()

  if (!events.length) return '- none'

  return events
    .map((event) => `- ${formatSydney(event.at)} [${event.type.toLowerCase()}] ${event.text}`)
    .join('\n')
}

server.registerTool(
  'his_seshstart',
  {
    description:
      'Start a Mental Health Incident System tracker session in drug_tracker_session. If current session is paused, resume it. Maps to /his-seshstart [optional datetime].',
    inputSchema: {
      datetime: z
        .string()
        .optional()
        .describe('Optional ISO datetime. Leave blank to use now.'),
    },
  },
  async ({ datetime }) => {
    const eventTime = parseOptionalDatetime(datetime)
    const existing = await getCurrentSession()

    if (existing) {
      const status = getLastStatus(existing)

      if (status === 'active') {
        return text(
          [
            'HIS tracker session already active.',
            `Session ID: ${existing.id}`,
            `Started: ${formatSydney(getStartIso(existing))}`,
            `Duration: ${msToHuman(activeDurationMs(existing))}`,
            `Entries: ${countHisEntries(existing)}`,
          ].join('\n'),
        )
      }

      const resumed = await appendToSession(existing, 'RESUME', 'Session resumed.', eventTime)

      return text(
        [
          'HIS tracker session resumed.',
          `Session ID: ${resumed.id}`,
          `Started: ${formatSydney(getStartIso(resumed))}`,
          `Resumed: ${formatSydney(eventTime)}`,
          `Duration: ${msToHuman(activeDurationMs(resumed))}`,
        ].join('\n'),
      )
    }

    const startNotes = makeHisLine('START', eventTime, 'Session started.')

    const { data, error } = await supabase
      .from(SESSION_TABLE)
      .insert({
        id: randomUUID(),
        user_id: hisUserId,
        date_start: isoToDateOnly(eventTime),
        sleep_hours: 0,
        any_incidents: '',
        personal_reflection: '',
        notes: startNotes,
        is_sensitive: false,
      })
      .select('*')
      .single()

    if (error) throw error

    const session = data as DrugTrackerSession

    return text(
      [
        'HIS tracker session started.',
        `Session ID: ${session.id}`,
        `Started: ${formatSydney(eventTime)}`,
        'Status: active',
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_seshstop',
  {
    description:
      'Pause or stop the current tracker session. First run pauses. Running again while paused stops and sets date_end. Maps to /his-seshstop.',
    inputSchema: {},
  },
  async () => {
    const session = await getCurrentSession()

    if (!session) {
      return text('No active or paused HIS tracker session found.')
    }

    const eventTime = nowIso()
    const status = getLastStatus(session)

    if (status === 'active') {
      const paused = await appendToSession(session, 'PAUSE', 'Session paused.', eventTime)

      return text(
        [
          'HIS tracker session paused.',
          `Session ID: ${paused.id}`,
          `Started: ${formatSydney(getStartIso(paused))}`,
          `Paused: ${formatSydney(eventTime)}`,
          `Tracked duration: ${msToHuman(activeDurationMs(paused))}`,
          'Run /his-seshstart to resume, or /his-seshstop again to stop.',
        ].join('\n'),
      )
    }

    const stopped = await stopSession(session, eventTime)

    return text(
      [
        'HIS tracker session stopped.',
        `Session ID: ${stopped.id}`,
        `Started: ${formatSydney(getStartIso(stopped))}`,
        `Stopped: ${formatSydney(eventTime)}`,
        `Tracked duration: ${msToHuman(activeDurationMs(stopped))}`,
        `Entries: ${countHisEntries(stopped)}`,
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_note',
  {
    description: 'Add a note to the current drug_tracker_session notes field. Maps to /his-note [text].',
    inputSchema: {
      text: z.string().min(1).describe('The note text to attach to the current tracker session.'),
    },
  },
  async ({ text: body }) => {
    const session = await getCurrentSession()

    if (!session) {
      return text('No active or paused HIS tracker session found. Run /his-seshstart first.')
    }

    const updated = await appendToSession(session, 'NOTE', body)

    return text(
      [
        'HIS note added.',
        `Session ID: ${updated.id}`,
        `Status: ${getLastStatus(updated)}`,
        `Note: ${body}`,
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_mood',
  {
    description: 'Add a quick mood marker to the current drug_tracker_session notes field. Maps to /his-mood [words].',
    inputSchema: {
      words: z.string().min(1).describe('Mood words/tags, e.g. angry, numb, wired, anxious, flat.'),
    },
  },
  async ({ words }) => {
    const session = await getCurrentSession()

    if (!session) {
      return text('No active or paused HIS tracker session found. Run /his-seshstart first.')
    }

    const updated = await appendToSession(session, 'MOOD', words)

    return text(
      [
        'HIS mood added.',
        `Session ID: ${updated.id}`,
        `Mood: ${words}`,
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_info',
  {
    description: 'Show current HIS tracker session state. Maps to /his-info.',
    inputSchema: {},
  },
  async () => {
    const session = await getCurrentSession()

    if (!session) {
      return text('No active or paused HIS tracker session found.')
    }

    const events = parseHisEvents(session.notes)

    return text(
      [
        'Current HIS tracker session:',
        `Session ID: ${session.id}`,
        `Status: ${getLastStatus(session, events)}`,
        `Started: ${formatSydney(getStartIso(session, events))}`,
        `Date start: ${session.date_start}`,
        `Date end: ${session.date_end ?? 'none'}`,
        `Tracked duration: ${msToHuman(activeDurationMs(session))}`,
        `Entries so far: ${events.length}`,
        `Mood: ${getLastMood(events)}`,
        '',
        'Recent entries:',
        eventSummary(session, 5),
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_list',
  {
    description: 'List recent drug_tracker_session rows for the configured HIS_USER_ID. Maps to /his-list.',
    inputSchema: {
      limit: z.number().int().min(1).max(20).optional().describe('Number of sessions to return. Default 5.'),
    },
  },
  async ({ limit }) => {
    const { data, error } = await supabase
      .from(SESSION_TABLE)
      .select('*')
      .eq('user_id', hisUserId)
      .order('created_at', { ascending: false })
      .limit(limit ?? 5)

    if (error) throw error

    const sessions = (data ?? []) as DrugTrackerSession[]

    if (!sessions.length) {
      return text('No drug tracker sessions found for HIS_USER_ID.')
    }

    return text(
      [
        'Recent HIS tracker sessions:',
        ...sessions.map((session) => {
          const events = parseHisEvents(session.notes)

          return [
            `- ${formatSydney(getStartIso(session, events))}`,
            `status=${getLastStatus(session, events)}`,
            `duration=${msToHuman(activeDurationMs(session))}`,
            `mood=${getLastMood(events)}`,
            `id=${session.id}`,
          ].join(' | ')
        }),
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_export',
  {
    description: 'Export one drug_tracker_session as a plain text timeline. Optional session_id. Maps to /his-export.',
    inputSchema: {
      session_id: z.string().uuid().optional().describe('Session UUID. If blank, exports current active/paused session or latest session.'),
    },
  },
  async ({ session_id }) => {
    let session: DrugTrackerSession | null = null

    if (session_id) {
      const { data, error } = await supabase
        .from(SESSION_TABLE)
        .select('*')
        .eq('id', session_id)
        .maybeSingle()

      if (error) throw error
      session = data as DrugTrackerSession | null
    } else {
      session = (await getCurrentSession()) ?? (await getLatestSession())
    }

    if (!session) {
      return text('No HIS tracker session found to export.')
    }

    const events = parseHisEvents(session.notes)

    return text(
      [
        'HIS TRACKER SESSION EXPORT',
        `Session ID: ${session.id}`,
        `User ID: ${session.user_id}`,
        `Status: ${getLastStatus(session, events)}`,
        `Date start: ${session.date_start}`,
        `Date end: ${session.date_end ?? 'none'}`,
        `Started: ${formatSydney(getStartIso(session, events))}`,
        `Tracked duration: ${msToHuman(activeDurationMs(session))}`,
        `Mood marker: ${getLastMood(events)}`,
        '',
        'Original fields:',
        `sleep_hours: ${session.sleep_hours ?? 'none'}`,
        `any_incidents: ${session.any_incidents ?? ''}`,
        `personal_reflection: ${session.personal_reflection ?? ''}`,
        '',
        'Timeline:',
        events.length
          ? events
              .map((event) =>
                [
                  `${formatSydney(event.at)} — ${event.type}`,
                  event.text ? `Text: ${event.text}` : null,
                ]
                  .filter(Boolean)
                  .join('\n'),
              )
              .join('\n\n')
          : 'No HIS timeline entries found in notes.',
        '',
        'Raw notes:',
        session.notes ?? '',
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_schema',
  {
    description: 'Show the database table/column assumptions this MCP uses.',
    inputSchema: {},
  },
  async () => {
    return text(
      [
        'HIS MCP database mapping:',
        `Main table: public.${SESSION_TABLE}`,
        'Required columns used:',
        '- id',
        '- user_id',
        '- date_start',
        '- date_end',
        '- sleep_hours',
        '- any_incidents',
        '- personal_reflection',
        '- notes',
        '- is_sensitive',
        '- created_at',
        '',
        'State is stored in notes using [HIS:START], [HIS:PAUSE], [HIS:RESUME], [HIS:STOP], [HIS:NOTE], and [HIS:MOOD] lines.',
        'Active/current session means: date_end is null for HIS_USER_ID.',
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_help',
  {
    description: 'Show HIS MCP command mapping.',
    inputSchema: {},
  },
  async () => {
    return text(
      [
        'HIS MCP commands:',
        '/his-seshstart [optional datetime] — starts a new tracker session, or resumes if paused.',
        '/his-seshstop — active session becomes paused; paused session becomes stopped and date_end is set.',
        '/his-note [text] — appends a note into drug_tracker_session.notes.',
        '/his-mood [words] — appends a mood marker into drug_tracker_session.notes.',
        '/his-info — shows current session state, duration, and recent entries.',
        '/his-list — shows recent tracker sessions.',
        '/his-export [optional session id] — exports one session as a timeline.',
        '/his-schema — shows database mapping.',
        '',
        'Actual MCP tool names:',
        'his_seshstart, his_seshstop, his_note, his_mood, his_info, his_list, his_export, his_schema, his_help',
      ].join('\n'),
    )
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('HIS MCP Server running on stdio')
}

main().catch((error) => {
  console.error('Fatal HIS MCP error:', error)
  process.exit(1)
})
