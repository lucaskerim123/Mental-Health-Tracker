import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local from project root
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

async function supabaseGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function supabasePost(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const server = new Server(
  { name: 'tracker-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'add_tracker_entry',
      description:
        'Add a journal entry to the current active drug tracker session. ' +
        'If no session_id is provided, targets the most recent ongoing session (date_end is null).',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The text content of the entry',
          },
          session_id: {
            type: 'string',
            description: 'Optional: specific session UUID. Defaults to current active session.',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'list_tracker_sessions',
      description: 'List recent drug tracker sessions (last 10), showing id, start date, and whether ongoing.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'list_tracker_sessions') {
    const sessions = await supabaseGet(
      '/drug_tracker_sessions?select=id,date_start,date_end,notes&order=created_at.desc&limit=10'
    )
    const lines = (sessions as Array<{ id: string; date_start: string; date_end: string | null; notes: string | null }>)
      .map(s => `${s.date_end ? '  ' : '→ '}${s.id}  started ${s.date_start}${s.date_end ? `  ended ${s.date_end}` : '  (ongoing)'}${s.notes ? `  — ${s.notes}` : ''}`)
      .join('\n')
    return {
      content: [{ type: 'text', text: lines || 'No sessions found.' }],
    }
  }

  if (name === 'add_tracker_entry') {
    const { content, session_id } = args as { content: string; session_id?: string }

    let targetId = session_id
    if (!targetId) {
      const active = await supabaseGet(
        '/drug_tracker_sessions?date_end=is.null&order=created_at.desc&limit=1&select=id,date_start'
      )
      if (!active || (active as unknown[]).length === 0) {
        return {
          content: [{ type: 'text', text: 'No active tracker session found. Start one first, or provide a session_id.' }],
        }
      }
      targetId = (active as Array<{ id: string; date_start: string }>)[0].id
    }

    const [entry] = await supabasePost('/tracker_entries', {
      session_id: targetId,
      content,
      source: 'mcp',
    })

    return {
      content: [{
        type: 'text',
        text: `Entry saved to session ${targetId}.\n\nContent: "${content}"\nID: ${entry.id}\nTime: ${entry.created_at}`,
      }],
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  process.stderr.write(String(err) + '\n')
  process.exit(1)
})
