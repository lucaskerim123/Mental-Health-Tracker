@echo off
setlocal EnableExtensions

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI\"
set "PORT=8001"
set "MCP_SCRIPT=%ROOT%mcp\his-py\start-mcp.ps1"
set "CODEX_EXE=C:\Users\Lucas\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe"

echo.
echo === Mental Health Tracker launcher ===
echo Repo : %ROOT%
echo Port : %PORT%
echo.

if not exist "%MCP_SCRIPT%" (
  echo Missing MCP launcher: %MCP_SCRIPT%
  pause
  exit /b 1
)

where ngrok >nul 2>&1
if errorlevel 1 (
  echo ngrok was not found on PATH. The local MCP server will still start.
) else (
  start "ngrok" /min ngrok http %PORT% --host-header=rewrite
)

start "HIS MCP" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%MCP_SCRIPT%" -Mode ChatGPT -Port %PORT%

timeout /t 4 /nobreak >nul

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (Test-NetConnection -ComputerName 127.0.0.1 -Port %PORT% -InformationLevel Quiet) { Write-Host 'Local MCP port is open.' } else { Write-Host 'Local MCP port is not open yet.' }"

if exist "%CODEX_EXE%" (
  start "Codex" /D "%ROOT%" "%CODEX_EXE%"
) else (
  where codex >nul 2>&1
  if errorlevel 1 (
    echo Codex was not found.
  ) else (
    start "Codex" /D "%ROOT%" codex
  )
)

echo.
echo Claude uses .mcp.json automatically.
echo ChatGPT needs the ngrok /mcp URL from the ngrok window.
echo Keep this window open if you want to see the startup summary.
pause
