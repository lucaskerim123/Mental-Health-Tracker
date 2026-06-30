@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI\"
set "PORT=8001"
set "CODEX_EXE=C:\Users\Lucas\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe"
set "HELPER_PY=%ROOT%bin\launcher_helpers.py"
set "RUN_MCP_CMD=%ROOT%bin\run-mcp-http.cmd"
set "START_MCP_PS1=%ROOT%bin\start-mcp-hidden.ps1"
set "MCP_HEALTH_URL=http://127.0.0.1:%PORT%/mcp"
set "MCP_REQUIRED_TOOLS=addnote,addsleep,createincident,help,lockdown,loguse,moodadd,seshexport,seshinfo,seshlist,startsesh,stopsesh,usehistory"
set "MCP_OUT_LOG=%TEMP%\his-mcp.out.log"
set "MCP_ERR_LOG=%TEMP%\his-mcp.err.log"
set "MCP_PID_FILE=%TEMP%\his-mcp.pid"
set "WATCHDOG_PID_FILE=%TEMP%\his-mcp-watchdog.pid"
set "WATCHDOG_LOG=%TEMP%\his-mcp-watchdog.log"
set "WATCHDOG_INTERVAL=15"
set "NGROK_URL="
set "MCP_STATE="
set "NGROK_STATE="
set "PYTHON_EXE="
set "ELEVATE_VBS=%ROOT%bin\launch-codex-mcp-admin.vbs"
set "CHATGPT_CONFIG_PS1=%ROOT%bin\open-chatgpt-mcp-config.ps1"

if /I "%~1"=="--watchdog" goto watchdog_entry

call :ensure_admin
if errorlevel 1 exit /b 1

call :resolve_python
if errorlevel 1 (
  echo Python was not found on PATH.
  pause
  exit /b 1
)

if not exist "%HELPER_PY%" (
  echo Missing launcher helper: %HELPER_PY%
  pause
  exit /b 1
)

if not exist "%RUN_MCP_CMD%" (
  echo Missing MCP runner: %RUN_MCP_CMD%
  pause
  exit /b 1
)

if not exist "%START_MCP_PS1%" (
  echo Missing MCP starter: %START_MCP_PS1%
  pause
  exit /b 1
)

if not exist "%CHATGPT_CONFIG_PS1%" (
  echo Missing ChatGPT config helper: %CHATGPT_CONFIG_PS1%
  pause
  exit /b 1
)

echo.
echo === Mental Health Tracker multi-option launcher ===
echo Repo   : %ROOT%
echo Port   : %PORT%
echo Python : %PYTHON_EXE%
echo.
echo Claude uses .mcp.json automatically.
echo Use option 1 to start the full Codex + ngrok + MCP flow.
echo Keep this window open while using launcher controls.
call :prompt_menu
exit /b 0

:prompt_menu
echo.
echo [1] Start current launch flow
echo [2] Restart MCP and ngrok
echo [3] Status check
echo [4] Force stop launched processes
echo [5] Launch Codex only
echo [6] Toggle auto-heal watchdog
echo [7] Quit
choice /C 1234567 /N /M "Choose an option: "
if errorlevel 7 exit
if errorlevel 6 (
  call :toggle_watchdog
  goto prompt_menu
)
if errorlevel 5 (
  call :launch_codex
  goto prompt_menu
)
if errorlevel 4 (
  call :force_stop_all
  echo.
  echo Launched processes were force stopped.
  goto prompt_menu
)
if errorlevel 3 (
  call :show_status
  goto prompt_menu
)
if errorlevel 2 (
  call :restart_mcp
  goto prompt_menu
)
if errorlevel 1 (
  call :run_launch_flow
  goto prompt_menu
)
exit

:resolve_python
where py >nul 2>&1
if not errorlevel 1 (
  set "PYTHON_EXE=py"
  exit /b 0
)
where python >nul 2>&1
if not errorlevel 1 (
  set "PYTHON_EXE=python"
  exit /b 0
)
exit /b 1

:ensure_admin
net session >nul 2>&1
if not errorlevel 1 exit /b 0

if not exist "%ELEVATE_VBS%" (
  echo Missing elevation helper: %ELEVATE_VBS%
  pause
  exit /b 1
)

echo Requesting administrator permissions...
wscript.exe "%ELEVATE_VBS%" "%~f0"
exit /b 1

:run_launch_flow
call :launch_codex
call :assess_runtime_state
if /I "%MCP_STATE%"=="ready" if /I "%NGROK_STATE%"=="ready" (
  echo MCP and ngrok are already healthy.
  choice /C RS /N /M "Press R to reuse them, or S to restart both: "
  if errorlevel 2 goto run_launch_flow_restart
  call :show_ngrok_url
  call :open_chatgpt_config
  echo HIS MCP is healthy at %MCP_HEALTH_URL%
  exit /b 0
)
if /I "%MCP_STATE%"=="conflict" (
  echo Port %PORT% is already in use, but HIS is not ready with the required tools.
  echo Free that port or choose option 2 to force a restart.
  call :show_mcp_logs
  exit /b 1
)
if /I "%MCP_STATE%"=="ready" if /I not "%NGROK_STATE%"=="ready" (
  echo HIS MCP is already healthy, but the ngrok tunnel for port %PORT% is unavailable.
  choice /C SFQ /N /M "Press S to start ngrok only, F to restart both, or Q to cancel: "
  if errorlevel 3 exit /b 1
  if errorlevel 2 goto run_launch_flow_restart
  call :start_ngrok
  call :show_ngrok_url
  call :open_chatgpt_config
  echo HIS MCP is healthy at %MCP_HEALTH_URL%
  exit /b 0
)
if /I not "%MCP_STATE%"=="ready" if /I "%NGROK_STATE%"=="ready" (
  echo ngrok is ready, but HIS MCP is not healthy yet.
  choice /C SFQ /N /M "Press S to start MCP only, F to restart both, or Q to cancel: "
  if errorlevel 3 exit /b 1
  if errorlevel 2 goto run_launch_flow_restart
  goto run_launch_flow_start
)
:run_launch_flow_start
call :start_ngrok
call :ensure_mcp_ready
if errorlevel 1 (
  echo HIS MCP did not become ready.
  call :show_mcp_logs
  exit /b 1
)
call :show_ngrok_url
call :open_chatgpt_config
echo HIS MCP is healthy at %MCP_HEALTH_URL%
exit /b 0

:run_launch_flow_restart
call :force_stop_all
goto run_launch_flow_start

:launch_codex
if exist "%CODEX_EXE%" (
  start "Codex" /D "%ROOT%" "%CODEX_EXE%"
  exit /b 0
)
where codex >nul 2>&1
if errorlevel 1 (
  echo Codex was not found.
  exit /b 1
)
start "Codex" /D "%ROOT%" codex
exit /b 0

:toggle_watchdog
call :is_watchdog_running
if not errorlevel 1 (
  call :stop_watchdog
  echo Auto-heal watchdog stopped.
  exit /b 0
)
call :start_watchdog
if errorlevel 1 (
  echo Failed to start the auto-heal watchdog.
  exit /b 1
)
echo Auto-heal watchdog started. It checks MCP and ngrok every %WATCHDOG_INTERVAL% seconds.
exit /b 0

:start_ngrok
where ngrok >nul 2>&1
if errorlevel 1 (
  echo ngrok was not found on PATH. The local MCP server will still start.
  exit /b 0
)
ngrok config check >nul 2>&1
if errorlevel 1 (
  echo ngrok is installed, but it is not configured yet.
  echo Run: ngrok config add-authtoken YOUR_TOKEN
  echo The local MCP server will still start, but the public tunnel will be skipped.
  exit /b 0
)
call :is_ngrok_running
if not errorlevel 1 (
  echo ngrok is already running for port %PORT%.
  exit /b 0
)
start "ngrok" /min ngrok http 127.0.0.1:%PORT% --host-header=rewrite
echo Waiting for ngrok public URL...
call :wait_for_ngrok
exit /b 0

:ensure_mcp_ready
call :is_mcp_ready
if errorlevel 1 goto ensure_mcp_port_check

call :has_required_tools
if errorlevel 1 (
  echo HIS MCP answered on %MCP_HEALTH_URL%, but the advertised tool list is incomplete.
  echo Expected tools: %MCP_REQUIRED_TOOLS%
  exit /b 1
)

echo HIS MCP is already running and exposes the required tools.
exit /b 0

:ensure_mcp_port_check
call :is_port_open
if not errorlevel 1 (
  echo Port %PORT% is already in use, but HIS is not ready with the required tools.
  echo Free that port or stop the conflicting process, then try again.
  exit /b 1
)

call :start_mcp
if errorlevel 1 exit /b 1

call :wait_for_mcp
exit /b %errorlevel%

:start_mcp
echo Starting HIS MCP...
if exist "%MCP_OUT_LOG%" del /q "%MCP_OUT_LOG%" >nul 2>&1
if exist "%MCP_ERR_LOG%" del /q "%MCP_ERR_LOG%" >nul 2>&1
if exist "%MCP_PID_FILE%" del /q "%MCP_PID_FILE%" >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%START_MCP_PS1%" -RunCmd "%RUN_MCP_CMD%" -Root "%ROOT%" -PythonExe "%PYTHON_EXE%" -Port %PORT% -OutLog "%MCP_OUT_LOG%" -ErrLog "%MCP_ERR_LOG%" -PidFile "%MCP_PID_FILE%" >nul 2>&1
timeout /t 1 /nobreak >nul
call :is_his_running
if errorlevel 1 (
  echo Failed to launch HIS MCP.
  call :show_mcp_logs
  exit /b 1
)
exit /b 0

:wait_for_mcp
set /a MCP_WAIT_ATTEMPT=1
:wait_for_mcp_loop
call :is_mcp_ready
if errorlevel 1 goto wait_for_retry
call :has_required_tools
if not errorlevel 1 exit /b 0
echo HIS MCP is answering, but the required tool list is not ready yet.
:wait_for_retry
if %MCP_WAIT_ATTEMPT% GEQ 8 (
  call :show_mcp_logs
  exit /b 1
)
echo Waiting for HIS MCP... %MCP_WAIT_ATTEMPT%/8
timeout /t 2 /nobreak >nul
set /a MCP_WAIT_ATTEMPT+=1
goto :wait_for_mcp_loop

:wait_for_ngrok
set /a NGROK_WAIT_ATTEMPT=1
:wait_for_ngrok_loop
call :is_ngrok_running
if not errorlevel 1 exit /b 0
if %NGROK_WAIT_ATTEMPT% GEQ 5 exit /b 0
timeout /t 1 /nobreak >nul
set /a NGROK_WAIT_ATTEMPT+=1
goto :wait_for_ngrok_loop

:restart_mcp
echo Restarting HIS MCP and ngrok...
call :force_stop_all
call :run_launch_flow
if errorlevel 1 (
  echo Restart failed.
  call :show_mcp_logs
  exit /b 1
)
echo Restart completed.
exit /b 0

:stop_runtime
call :stop_existing_mcp
call :stop_ngrok
exit /b 0

:force_stop_all
call :stop_existing_mcp
call :stop_ngrok
call :stop_watchdog
call :stop_launcher_helpers
taskkill /IM codex.exe /T /F >nul 2>&1
timeout /t 1 /nobreak >nul
exit /b 0

:stop_existing_mcp
if exist "%MCP_PID_FILE%" (
  set /p MCP_PID=<"%MCP_PID_FILE%"
  if defined MCP_PID taskkill /PID !MCP_PID! /T /F >nul 2>&1
  del /q "%MCP_PID_FILE%" >nul 2>&1
)
for /f "usebackq delims=" %%P in (`powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='py.exe'\") ^| Where-Object { $_.CommandLine -like '*mcp\\his-py\\server.py*' -or $_.CommandLine -like '*mcp\\his-py\\chatgpt_server.py*' } ^| Select-Object -ExpandProperty ProcessId"`) do taskkill /PID %%P /T /F >nul 2>&1
timeout /t 1 /nobreak >nul
exit /b 0

:stop_ngrok
for /f "usebackq delims=" %%P in (`powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"Name='ngrok.exe'\") ^| Where-Object { $_.CommandLine -like '*127.0.0.1:%PORT%*' -or $_.CommandLine -like '*localhost:%PORT%*' } ^| Select-Object -ExpandProperty ProcessId"`) do taskkill /PID %%P /T /F >nul 2>&1
timeout /t 1 /nobreak >nul
exit /b 0

:stop_launcher_helpers
taskkill /IM Mental-Health-Tracker-Launcher.exe /T /F >nul 2>&1
for /f "usebackq delims=" %%P in (`powershell.exe -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\") ^| Where-Object { $_.CommandLine -like '*launch-codex-mcp.cmd*' -or $_.CommandLine -like '*run-launcher.cmd*' } ^| Select-Object -ExpandProperty ProcessId"`) do taskkill /PID %%P /T /F >nul 2>&1
timeout /t 1 /nobreak >nul
exit /b 0

:show_status
echo.
echo === Status ===
echo Repo : %ROOT%
echo Port : %PORT%

call :is_port_open
if errorlevel 1 (
  echo Port : closed
) else (
  echo Port : open
)

call :is_mcp_ready
if errorlevel 1 (
  call :is_port_open
  if errorlevel 1 (
    echo MCP  : stopped
  ) else (
    echo MCP  : port occupied, not ready
  )
) else (
  echo MCP  : responding
  call :has_required_tools
  if errorlevel 1 (
    echo Tools: incomplete
  ) else (
    echo Tools: ready
  )
)

call :is_ngrok_running
if errorlevel 1 (
  echo ngrok: tunnel unavailable
) else (
  echo ngrok: tunnel ready
)

call :is_his_running
if errorlevel 1 (
  echo HIS  : not detected
) else (
  echo HIS  : launching or running
)

tasklist /FI "IMAGENAME eq codex.exe" | findstr /I /C:"codex.exe" >nul
if errorlevel 1 (
  echo Codex: not detected
) else (
  echo Codex: running
)

call :is_watchdog_running
if errorlevel 1 (
  echo Watch: disabled
) else (
  echo Watch: active
)

call :show_ngrok_url_noclip
exit /b 0

:show_ngrok_url
set "NGROK_URL="
for /f "usebackq delims=" %%U in (`"%PYTHON_EXE%" "%HELPER_PY%" ngrok-url --port %PORT%`) do set "NGROK_URL=%%U"
if defined NGROK_URL (
  echo Public ngrok URL: %NGROK_URL%
  <nul set /p "=%NGROK_URL%" | clip
  echo Copied ngrok URL to clipboard.
  exit /b 0
)
echo Public ngrok URL: unavailable
exit /b 1

:show_ngrok_url_noclip
set "NGROK_URL="
for /f "usebackq delims=" %%U in (`"%PYTHON_EXE%" "%HELPER_PY%" ngrok-url --port %PORT%`) do set "NGROK_URL=%%U"
if defined NGROK_URL (
  echo Public ngrok URL: %NGROK_URL%
  exit /b 0
)
echo Public ngrok URL: unavailable
exit /b 1

:open_chatgpt_config
if not defined NGROK_URL exit /b 0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CHATGPT_CONFIG_PS1%" -ConnectorUrl "%NGROK_URL%" >nul 2>&1
exit /b 0

:is_port_open
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
exit /b %errorlevel%

:is_mcp_ready
"%PYTHON_EXE%" "%HELPER_PY%" mcp-ready --url "%MCP_HEALTH_URL%" >nul 2>&1
exit /b %errorlevel%

:has_required_tools
"%PYTHON_EXE%" "%HELPER_PY%" required-tools --url "%MCP_HEALTH_URL%" --required "%MCP_REQUIRED_TOOLS%" >nul 2>&1
exit /b %errorlevel%

:is_ngrok_running
"%PYTHON_EXE%" "%HELPER_PY%" ngrok-ready --port %PORT% >nul 2>&1
exit /b %errorlevel%

:is_his_running
if exist "%MCP_PID_FILE%" (
  set /p MCP_PID=<"%MCP_PID_FILE%"
  if defined MCP_PID (
    tasklist /FI "PID eq !MCP_PID!" | findstr /R /C:"[0-9][0-9]*" >nul
    if not errorlevel 1 exit /b 0
  )
)
call :is_mcp_ready
if not errorlevel 1 exit /b 0
exit /b 1

:is_watchdog_running
if exist "%WATCHDOG_PID_FILE%" (
  set /p WATCHDOG_PID=<"%WATCHDOG_PID_FILE%"
  if defined WATCHDOG_PID (
    tasklist /FI "PID eq !WATCHDOG_PID!" | findstr /R /C:"[0-9][0-9]*" >nul
    if not errorlevel 1 exit /b 0
  )
  del /q "%WATCHDOG_PID_FILE%" >nul 2>&1
)
exit /b 1

:start_watchdog
call :is_watchdog_running
if not errorlevel 1 exit /b 0
if exist "%WATCHDOG_LOG%" del /q "%WATCHDOG_LOG%" >nul 2>&1
start "HIS Watchdog" /min cmd.exe /c ""%~f0" --watchdog"
set /a WATCHDOG_WAIT_ATTEMPT=1
:wait_for_watchdog_loop
call :is_watchdog_running
if not errorlevel 1 exit /b 0
if %WATCHDOG_WAIT_ATTEMPT% GEQ 5 exit /b 1
timeout /t 1 /nobreak >nul
set /a WATCHDOG_WAIT_ATTEMPT+=1
goto :wait_for_watchdog_loop

:stop_watchdog
if exist "%WATCHDOG_PID_FILE%" (
  set /p WATCHDOG_PID=<"%WATCHDOG_PID_FILE%"
  if defined WATCHDOG_PID taskkill /PID !WATCHDOG_PID! /T /F >nul 2>&1
  del /q "%WATCHDOG_PID_FILE%" >nul 2>&1
)
exit /b 0

:assess_runtime_state
set "MCP_STATE=stopped"
set "NGROK_STATE=unavailable"
call :is_mcp_ready
if errorlevel 1 (
  call :is_port_open
  if not errorlevel 1 set "MCP_STATE=conflict"
) else (
  call :has_required_tools
  if errorlevel 1 (
    set "MCP_STATE=incomplete"
  ) else (
    set "MCP_STATE=ready"
  )
)
call :is_ngrok_running
if not errorlevel 1 set "NGROK_STATE=ready"
exit /b 0

:show_mcp_logs
echo stdout log: %MCP_OUT_LOG%
echo stderr log: %MCP_ERR_LOG%
powershell.exe -NoProfile -Command "if (Test-Path '%MCP_OUT_LOG%') { Write-Output '--- stdout tail ---'; Get-Content '%MCP_OUT_LOG%' -Tail 20 }; if (Test-Path '%MCP_ERR_LOG%') { Write-Output '--- stderr tail ---'; Get-Content '%MCP_ERR_LOG%' -Tail 20 }"
exit /b %errorlevel%

:watchdog_entry
setlocal EnableExtensions EnableDelayedExpansion
call :resolve_python
if errorlevel 1 exit /b 1
if exist "%WATCHDOG_PID_FILE%" (
  set /p EXISTING_WATCHDOG_PID=<"%WATCHDOG_PID_FILE%"
  if defined EXISTING_WATCHDOG_PID (
    tasklist /FI "PID eq !EXISTING_WATCHDOG_PID!" | findstr /R /C:"[0-9][0-9]*" >nul
    if not errorlevel 1 exit /b 0
  )
)
echo !DATE! !TIME! watchdog starting>"%WATCHDOG_LOG%"
set "THIS_PID="
for /f "usebackq delims=" %%P in (`powershell.exe -NoProfile -Command "$PID"`) do set "THIS_PID=%%P"
if not defined THIS_PID exit /b 1
> "%WATCHDOG_PID_FILE%" echo !THIS_PID!
:watchdog_loop
call :assess_runtime_state
if /I not "!MCP_STATE!"=="ready" (
  >>"%WATCHDOG_LOG%" echo !DATE! !TIME! MCP state=!MCP_STATE! - attempting recovery
  call :ensure_mcp_ready
  if errorlevel 1 (
    >>"%WATCHDOG_LOG%" echo !DATE! !TIME! MCP recovery failed
  ) else (
    >>"%WATCHDOG_LOG%" echo !DATE! !TIME! MCP recovery succeeded
  )
)
call :is_ngrok_running
if errorlevel 1 (
  >>"%WATCHDOG_LOG%" echo !DATE! !TIME! ngrok unavailable - attempting restart
  call :start_ngrok
  call :is_ngrok_running
  if errorlevel 1 (
    >>"%WATCHDOG_LOG%" echo !DATE! !TIME! ngrok recovery failed
  ) else (
    >>"%WATCHDOG_LOG%" echo !DATE! !TIME! ngrok recovery succeeded
  )
)
timeout /t %WATCHDOG_INTERVAL% /nobreak >nul
goto watchdog_loop
