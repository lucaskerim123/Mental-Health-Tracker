# Claude / ChatGPT MCP

This repository uses one MCP server implementation:

```text
mcp/his-py/server.py
```

The switch is transport only.

## Claude

Claude uses stdio through `.mcp.json`, and the active local config exposes the
server as `his`.

## ChatGPT

ChatGPT uses the same server over HTTP. Start it with:

```powershell
.\mcp\his-py\start-mcp.ps1 -Mode ChatGPT
```

By default it listens locally at:

```text
http://127.0.0.1:8001/mcp
```

For ChatGPT to reach it, expose that local URL with an HTTPS tunnel and use the
public `/mcp` URL as the connector endpoint.

Example:

```powershell
.\mcp\his-py\start-mcp.ps1 -Mode ChatGPT -Port 8001
```

```text
https://your-tunnel.example.com/mcp
```

Required environment values are loaded from `.env.local` if present:

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HIS_USER_ID`

Summary:

- Claude = stdio
- ChatGPT = streamable HTTP
