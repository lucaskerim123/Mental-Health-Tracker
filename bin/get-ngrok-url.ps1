param(
  [int]$Port = 8001,
  [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "SilentlyContinue"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  try {
    $tunnels = (Invoke-RestMethod "http://127.0.0.1:4040/api/tunnels").tunnels
    $url = $tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    if ($url) {
      Write-Output $url
      exit 0
    }
  } catch {
  }

  Start-Sleep -Seconds 1
}

exit 1
