#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const HOLD_NAME = 'mental-health-incident-system'
const VERSION = '0.1.0'

type HisSession = {
  id: string
  status: 'active' | 'paused' | 'stopped'
  started_at: string
  paused_at: string | null
  stopped_at: string | null
  total_paused_ms: number
  mood_marker: string | null
  source: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

type HisEntry = {
  id: string
  session_id: string
  entry_type: 'start' | 'resume' | 'pause' | 'stop' | 'note' | 'mood' | 'tag' | 'info'
  body: string | null
  mood: string | null
  occurred_at: string
  created_at: string
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

const server = new McpServer({
  name: HOLD_NAME,
  version: VERSION,
})

function nowIso() {
  return new Date().toISOString()
}

function parseOptionalDatetime(datetime?: string) {
  if (!datetime || !datetime.trim()) return nowIso()

  const parsed = new Date(datetime)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime: ${datetime}. Use ISO format or have the assistant convert natural language to ISO first.`)
  }

  return parsed.toISOString()
}

function msToHuman(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function formatSydney(iso: string | null) {
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

function activeDurationMs(session: HisSession) {
  const start = Date.parse(session.started_at)
  const end =
    session.status === 'paused' && session.paused_at
      ? Date.parse(session.paused_at)
      : session.stopped_at
        ? Date.parse(session.stopped_at)
        : Date.now()

  return Math.max(0, end - start - Number(session.total_paused_ms ?? 0))
}

async function getCurrentSession() {
  const { data, error } = await supabase
    .from('his_sessions')
    .select('*')
    .in('status', ['active', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data as HisSession | null
}

async function countEntries(sessionId: string) {
  const { count, error } = await supabase
    .from('his_entries')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  if (error) throw error

  return count ?? 0
}

async function addEntry(params: {
  sessionId: string
  entryType: HisEntry['entry_type']
  body?: string
  mood?: string
  occurredAt?: string
}) {
  const { error } = await supabase.from('his_entries').insert({
    session_id: params.sessionId,
    entry_type: params.entryType,
    body: params.body ?? null,
    mood: params.mood ?? null,
    occurred_at: params.occurredAt ?? nowIso(),
  })

  if (error) throw error
}

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

server.registerTool(
  'his_seshstart',
  {
    description:
      'Start a HIS incident/session. If a session is paused, this resumes it. This maps to /his-seshstart with optional datetime.',
    inputSchema: {
      datetime: z
        .string()
        .optional()
        .describe('Optional ISO datetime. Leave blank to use now. If user gives natural language, convert to ISO before calling.'),
    },
  },
  async ({ datetime }) => {
    const existing = await getCurrentSession()
    const eventTime = parseOptionalDatetime(datetime)

    if (existing?.status === 'active') {
      return text(
        [
          'HIS session already active.',
          `Started: ${formatSydney(existing.started_at)}`,
          `Duration: ${msToHuman(activeDurationMs(existing))}`,
          `Mood: ${existing.mood_marker ?? 'none'}`,
        ].join('\n'),
      )
    }

    if (existing?.status === 'paused') {
      const pausedAt = existing.paused_at ? Date.parse(existing.paused_at) : Date.now()
      const resumedAt = Date.parse(eventTime)
      const addedPausedMs = Math.max(0, resumedAt - pausedAt)
      const totalPausedMs = Number(existing.total_paused_ms ?? 0) + addedPausedMs

      const { data, error } = await supabase
        .from('his_sessions')
        .update({
          status: 'active',
          paused_at: null,
          total_paused_ms: totalPausedMs,
          updated_at: eventTime,
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (error) throw error

      await addEntry({
        sessionId: existing.id,
        entryType: 'resume',
        body: 'Session resumed.',
        occurredAt: eventTime,
      })

      const session = data as HisSession

      return text(
        [
          'HIS session resumed.',
          `Started: ${formatSydney(session.started_at)}`,
          `Resumed: ${formatSydney(eventTime)}`,
          `Duration: ${msToHuman(activeDurationMs(session))}`,
        ].join('\n'),
      )
    }

    const { data, error } = await supabase
      .from('his_sessions')
      .insert({
        status: 'active',
        started_at: eventTime,
        source: 'mcp',
      })
      .select('*')
      .single()

    if (error) throw error

    const session = data as HisSession

    await addEntry({
      sessionId: session.id,
      entryType: 'start',
      body: 'Session started.',
      occurredAt: eventTime,
    })

    return text(
      [
        'HIS session started.',
        `Session ID: ${session.id}`,
        `Started: ${formatSydney(session.started_at)}`,
        'Status: active',
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_seshstop',
  {
    description:
      'Pause or stop the current HIS session. First run pauses an active session. Running again while paused stops it. Maps to /his-seshstop.',
    inputSchema: {},
  },
  async () => {
    const session = await getCurrentSession()

    if (!session) {
      return text('No active or paused HIS session found.')
    }

    const eventTime = nowIso()

    if (session.status === 'active') {
      const { data, error } = await supabase
        .from('his_sessions')
        .update({
          status: 'paused',
          paused_at: eventTime,
          updated_at: eventTime,
        })
        .eq('id', session.id)
        .select('*')
        .single()

      if (error) throw error

      await addEntry({
        sessionId: session.id,
        entryType: 'pause',
        body: 'Session paused.',
        occurredAt: eventTime,
      })

      const paused = data as HisSession

      return text(
        [
          'HIS session paused.',
          `Started: ${formatSydney(paused.started_at)}`,
          `Paused: ${formatSydney(paused.paused_at)}`,
          `Tracked duration: ${msToHuman(activeDurationMs(paused))}`,
          'Run /his-seshstart to resume, or /his-seshstop again to stop.',
        ].join('\n'),
      )
    }

    const { data, error } = await supabase
      .from('his_sessions')
      .update({
        status: 'stopped',
        stopped_at: eventTime,
        updated_at: eventTime,
      })
      .eq('id', session.id)
      .select('*')
      .single()

    if (error) throw error

    await addEntry({
      sessionId: session.id,
      entryType: 'stop',
      body: 'Session stopped.',
      occurredAt: eventTime,
    })

    const stopped = data as HisSession
    const entries = await countEntries(stopped.id)

    return text(
      [
        'HIS session stopped.',
        `Started: ${formatSydney(stopped.started_at)}`,
        `Stopped: ${formatSydney(stopped.stopped_at)}`,
        `Tracked duration: ${msToHuman(activeDurationMs(stopped))}`,
        `Entries: ${entries}`,
        `Mood: ${stopped.mood_marker ?? 'none'}`,
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_note',
  {
    description: 'Add a mid-session note/log entry. Maps to /his-note [text].',
    inputSchema: {
      text: z.string().min(1).describe('The note/log text to attach to the current session.'),
    },
  },
  async ({ text: body }) => {
    const session = await getCurrentSession()

    if (!session) {
      return text('No active or paused HIS session found. Run /his-seshstart first.')
    }

    await addEntry({
      sessionId: session.id,
      entryType: 'note',
      body,
    })

    return text(
      [
        'HIS note added.',
        `Session: ${session.id}`,
        `Status: ${session.status}`,
        `Note: ${body}`,
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_mood',
  {
    description: 'Add/update quick mood words during the current session. Maps to /his-mood [words].',
    inputSchema: {
      words: z.string().min(1).describe('Mood words/tags, e.g. angry, numb, wired, anxious, flat.'),
    },
  },
  async ({ words }) => {
    const session = await getCurrentSession()

    if (!session) {
      return text('No active or paused HIS session found. Run /his-seshstart first.')
    }

    const eventTime = nowIso()

    const { error } = await supabase
      .from('his_sessions')
      .update({
        mood_marker: words,
        updated_at: eventTime,
      })
      .eq('id', session.id)

    if (error) throw error

    await addEntry({
      sessionId: session.id,
      entryType: 'mood',
      body: `Mood marker: ${words}`,
      mood: words,
      occurredAt: eventTime,
    })

    return text(
      [
        'HIS mood updated.',
        `Session: ${session.id}`,
        `Mood: ${words}`,
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_info',
  {
    description: 'Show current HIS session state. Maps to /his-info.',
    inputSchema: {},
  },
  async () => {
    const session = await getCurrentSession()

    if (!session) {
      return text('No active or paused HIS session found.')
    }

    const entries = await countEntries(session.id)

    const { data, error } = await supabase
      .from('his_entries')
      .select('*')
      .eq('session_id', session.id)
      .order('occurred_at', { ascending: false })
      .limit(5)

    if (error) throw error

    const recent = (data ?? []) as HisEntry[]

    return text(
      [
        'Current HIS session:',
        `Session ID: ${session.id}`,
        `Status: ${session.status}`,
        `Started: ${formatSydney(session.started_at)}`,
        `Paused: ${formatSydney(session.paused_at)}`,
        `Tracked duration: ${msToHuman(activeDurationMs(session))}`,
        `Entries so far: ${entries}`,
        `Mood: ${session.mood_marker ?? 'none'}`,
        '',
        'Recent entries:',
        recent.length
          ? recent
              .map((entry) => `- ${formatSydney(entry.occurred_at)} [${entry.entry_type}] ${entry.mood ?? entry.body ?? ''}`)
              .join('\n')
          : '- none',
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_list',
  {
    description: 'List recent HIS sessions. Maps to /his-list.',
    inputSchema: {
      limit: z.number().int().min(1).max(20).optional().describe('Number of sessions to return. Default 5.'),
    },
  },
  async ({ limit }) => {
    const { data, error } = await supabase
      .from('his_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit ?? 5)

    if (error) throw error

    const sessions = (data ?? []) as HisSession[]

    if (!sessions.length) {
      return text('No HIS sessions found.')
    }

    return text(
      [
        'Recent HIS sessions:',
        ...sessions.map((session) =>
          [
            `- ${formatSydney(session.started_at)}`,
            `status=${session.status}`,
            `duration=${msToHuman(activeDurationMs(session))}`,
            `mood=${session.mood_marker ?? 'none'}`,
            `id=${session.id}`,
          ].join(' | '),
        ),
      ].join('\n'),
    )
  },
)

server.registerTool(
  'his_export',
  {
    description: 'Export one session as a plain text timeline. Useful for review/reporting. Optional extra command.',
    inputSchema: {
      session_id: z.string().uuid().optional().describe('Session UUID. If blank, exports current active/paused session or latest session.'),
    },
  },
  async ({ session_id }) => {
    let session: HisSession | null = null

    if (session_id) {
      const { data, error } = await supabase
        .from('his_sessions')
        .select('*')
        .eq('id', session_id)
        .maybeSingle()

      if (error) throw error
      session = data as HisSession | null
    } else {
      session = await getCurrentSession()

      if (!session) {
        const { data, error } = await supabase
          .from('his_sessions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) throw error
        session = data as HisSession | null
      }
    }

    if (!session) {
      return text('No HIS session found to export.')
    }

    const { data, error } = await supabase
      .from('his_entries')
      .select('*')
      .eq('session_id', session.id)
      .order('occurred_at', { ascending: true })

    if (error) throw error

    const entries = (data ?? []) as HisEntry[]

    return text(
      [
        'HIS SESSION EXPORT',
        `Session ID: ${session.id}`,
        `Status: ${session.status}`,
        `Started: ${formatSydney(session.started_at)}`,
        `Paused: ${formatSydney(session.paused_at)}`,
        `Stopped: ${formatSydney(session.stopped_at)}`,
        `Tracked duration: ${msToHuman(activeDurationMs(session))}`,
        `Mood marker: ${session.mood_marker ?? 'none'}`,
        '',
        'Timeline:',
        entries.length
          ? entries
              .map((entry) =>
                [
                  `${formatSydney(entry.occurred_at)} — ${entry.entry_type.toUpperCase()}`,
                  entry.mood ? `Mood: ${entry.mood}` : null,
                  entry.body ? `Text: ${entry.body}` : null,
                ]
                  .filter(Boolean)
                  .join('\n'),
              )
              .join('\n\n')
          : 'No entries.',
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
        '/his-seshstart [optional datetime] — starts a new session, or resumes if paused.',
        '/his-seshstop — active session becomes paused; paused session becomes stopped.',
        '/his-note [text] — adds a mid-session note/log entry.',
        '/his-mood [words] — sets quick mood marker during the session.',
        '/his-info — shows current session state, duration, and recent entries.',
        '/his-list — shows recent sessions.',
        '/his-export [optional session id] — exports one session as a timeline.',
        '',
        'Actual MCP tool names:',
        'his_seshstart, his_seshstop, his_note, his_mood, his_info, his_list, his_export, his_help',
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
