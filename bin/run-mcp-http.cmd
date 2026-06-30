@echo off
setlocal EnableExtensions

set "ROOT=%~1"
set "PYTHON_EXE=%~2"
set "PORT=%~3"
set "OUT_LOG=%~4"
set "ERR_LOG=%~5"

cd /d "%ROOT%"
set "HIS_TRANSPORT=http"
set "HIS_MCP_HOST=127.0.0.1"
set "HIS_MCP_PORT=%PORT%"
set "HIS_MCP_PATH=/mcp"

"%PYTHON_EXE%" mcp\his-py\chatgpt_server.py 1>>"%OUT_LOG%" 2>>"%ERR_LOG%"
