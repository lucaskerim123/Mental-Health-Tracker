param(
  [Parameter(Mandatory = $true)]
  [string]$RunCmd,
  [Parameter(Mandatory = $true)]
  [string]$Root,
  [Parameter(Mandatory = $true)]
  [string]$PythonExe,
  [Parameter(Mandatory = $true)]
  [int]$Port,
  [Parameter(Mandatory = $true)]
  [string]$OutLog,
  [Parameter(Mandatory = $true)]
  [string]$ErrLog,
  [Parameter(Mandatory = $true)]
  [string]$PidFile
)

$ErrorActionPreference = "Stop"

$cmdArgs = @(
  "/c",
  "`"$RunCmd`" `"$Root`" `"$PythonExe`" `"$Port`" `"$OutLog`" `"$ErrLog`""
)

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = "cmd.exe"
$startInfo.Arguments = ($cmdArgs -join " ")
$startInfo.WorkingDirectory = $Root
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true

# PowerShell can expose both Path and PATH in the process environment.
# Windows child-process launch treats those as the same key and can throw.
$rawEnv = [System.Environment]::GetEnvironmentVariables()
$pathValue = ""
if ($rawEnv.Contains("PATH") -and [string]::IsNullOrWhiteSpace([string]$rawEnv["PATH"]) -eq $false) {
  $pathValue = [string]$rawEnv["PATH"]
} elseif ($rawEnv.Contains("Path") -and [string]::IsNullOrWhiteSpace([string]$rawEnv["Path"]) -eq $false) {
  $pathValue = [string]$rawEnv["Path"]
}
if ($pathValue) {
  [System.Environment]::SetEnvironmentVariable("PATH", $null, "Process")
  [System.Environment]::SetEnvironmentVariable("Path", $pathValue, "Process")
}

$process = [System.Diagnostics.Process]::Start($startInfo)
Set-Content -Path $PidFile -Value $process.Id -Encoding ASCII
