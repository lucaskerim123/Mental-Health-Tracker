param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$workDir = Join-Path $PSScriptRoot "iexpress-build"
$payloadPath = Join-Path $workDir "run-launcher.cmd"
$sedPath = Join-Path $workDir "launcher.sed"
$targetExe = Join-Path $PSScriptRoot "Mental-Health-Tracker-Launcher.exe"
$launcherPath = Join-Path $repoRoot "bin\launch-codex-mcp.cmd"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$payload = @"
@echo off
call "$launcherPath"
"@
Set-Content -Path $payloadPath -Value $payload -Encoding ASCII

$escapedWorkDir = $workDir.Replace("\", "\\")
$escapedTargetExe = $targetExe.Replace("\", "\\")

$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$escapedTargetExe
FriendlyName=Mental Health Tracker Launcher
AppLaunched=run-launcher.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=run-launcher.cmd
UserQuietInstCmd=run-launcher.cmd
SourceFiles=SourceFiles
[Strings]
FILE0=run-launcher.cmd
[SourceFiles]
SourceFiles0=$escapedWorkDir
[SourceFiles0]
%FILE0%=
"@
Set-Content -Path $sedPath -Value $sed -Encoding ASCII

& iexpress /N /Q $sedPath | Out-Null

if (-not (Test-Path $targetExe)) {
  throw "IExpress did not produce the launcher EXE."
}

Write-Host "Built EXE: $targetExe"
