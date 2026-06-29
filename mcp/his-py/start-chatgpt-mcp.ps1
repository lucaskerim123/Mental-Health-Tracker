param(
  [int]$Port = 8001,
  [string]$HostName = "127.0.0.1",
  [string]$Path = "/mcp"
)

& "$PSScriptRoot\start-mcp.ps1" -Mode ChatGPT -Port $Port -HostName $HostName -Path $Path
