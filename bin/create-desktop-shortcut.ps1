param(
  [string]$ShortcutName = "Mental Health Tracker"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$launcherExe = Join-Path $repoRoot "bin\Mental-Health-Tracker-Launcher.exe"
$launcherTarget = Join-Path $repoRoot "bin\launch-codex-mcp.cmd"
$elevatedLauncher = Join-Path $repoRoot "bin\launch-codex-mcp-admin.vbs"
$wscriptExe = Join-Path $env:SystemRoot "System32\wscript.exe"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "$ShortcutName.lnk"

if (-not (Test-Path $launcherExe) -and -not (Test-Path $launcherTarget)) {
  throw "Missing launcher target: $launcherTarget"
}

if (-not (Test-Path $elevatedLauncher)) {
  throw "Missing elevated launcher: $elevatedLauncher"
}

if (-not (Test-Path $wscriptExe)) {
  throw "Missing wscript.exe: $wscriptExe"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)

# The packaged EXE can launch without a visible console from a .lnk, which makes
# failures look like "nothing happened". Route the shortcut through the elevated
# VBS wrapper so the CMD-based launcher is always visible.
$shortcut.TargetPath = $wscriptExe
$shortcut.Arguments = "`"$elevatedLauncher`" `"$launcherTarget`""
$shortcut.WorkingDirectory = $repoRoot.Path
$shortcut.WindowStyle = 1
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Save()

Write-Host "Created shortcut: $shortcutPath"
Write-Host "Target: $($shortcut.TargetPath)"
Write-Host "Arguments: $($shortcut.Arguments)"
