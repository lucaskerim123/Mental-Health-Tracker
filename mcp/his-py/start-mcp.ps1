param(
  [ValidateSet("Claude", "ChatGPT")]
  [string]$Mode = "Claude",
  [int]$Port = 8001,
  [string]$HostName = "127.0.0.1",
  [string]$Path = "/mcp"
)

$ErrorActionPreference = "Stop"

# Claude uses stdio through .mcp.json.
# ChatGPT uses streamable HTTP on the same server entrypoint.

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if ($Mode -eq "ChatGPT") {
  $env:HIS_TRANSPORT = "http"
  $env:HIS_MCP_HOST = $HostName
  $env:HIS_MCP_PORT = [string]$Port
  $env:HIS_MCP_PATH = $Path
} else {
  $env:HIS_TRANSPORT = "stdio"
  Remove-Item Env:HIS_MCP_HOST -ErrorAction SilentlyContinue
  Remove-Item Env:HIS_MCP_PORT -ErrorAction SilentlyContinue
  Remove-Item Env:HIS_MCP_PATH -ErrorAction SilentlyContinue
}

python mcp\his-py\server.py
