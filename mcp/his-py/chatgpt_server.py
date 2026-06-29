#!/usr/bin/env python3
"""
ChatGPT-facing HIS MCP server.

Claude uses the repository .mcp.json stdio entrypoint. This file is separate
and only starts the same tools over Streamable HTTP for ChatGPT connectors.
"""

from __future__ import annotations

import os

from mcp.server.transport_security import TransportSecuritySettings

from server import mcp


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name, "").strip()
    return int(value) if value else default


if __name__ == "__main__":
    mcp.settings.host = os.environ.get("HIS_MCP_HOST", "127.0.0.1")
    mcp.settings.port = _env_int("HIS_MCP_PORT", 8001)
    mcp.settings.streamable_http_path = os.environ.get("HIS_MCP_PATH", "/mcp")
    mcp.settings.transport_security = TransportSecuritySettings(
        enable_dns_rebinding_protection=False
    )
    mcp.run(transport="streamable-http")
