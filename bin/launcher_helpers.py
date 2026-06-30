#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request


def _http_get(url: str, timeout: float = 2.0) -> str:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _http_post(url: str, payload: dict, headers: dict[str, str] | None = None, timeout: float = 3.0) -> tuple[dict[str, str], str]:
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json, text/event-stream")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return dict(resp.headers.items()), resp.read().decode("utf-8", errors="replace")


def _extract_sse_json(body: str) -> dict:
    match = re.search(r"data:\s*(\{.*\})", body, re.DOTALL)
    if not match:
        raise RuntimeError("No MCP event payload found.")
    return json.loads(match.group(1))


def _load_tunnels(timeout: float) -> list[dict]:
    body = _http_get("http://127.0.0.1:4040/api/tunnels", timeout=timeout)
    payload = json.loads(body)
    return payload.get("tunnels", [])


def _tunnel_matches_port(tunnel: dict, port: int) -> bool:
    config = tunnel.get("config", {})
    addr = str(config.get("addr", "")).lower().strip()
    target_port = str(port)
    if not addr:
        return False
    return addr.endswith(f":{target_port}") and ("127.0.0.1" in addr or "localhost" in addr)


def _get_ngrok_public_url(port: int, timeout: float) -> str | None:
    for tunnel in _load_tunnels(timeout):
        if tunnel.get("proto") != "https":
            continue
        if _tunnel_matches_port(tunnel, port):
            return str(tunnel.get("public_url", "")).strip() or None
    return None


def cmd_mcp_ready(args: argparse.Namespace) -> int:
    try:
        _http_get(args.url, timeout=args.timeout)
        return 0
    except urllib.error.HTTPError:
        return 0
    except Exception:
        return 1


def cmd_required_tools(args: argparse.Namespace) -> int:
    required = [item.strip() for item in args.required.split(",") if item.strip()]
    try:
        init_headers, _ = _http_post(
            args.url,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "clientInfo": {"name": "launcher-check", "version": "1.0"},
                },
            },
            timeout=args.timeout,
        )
        session_id = init_headers.get("mcp-session-id")
        if not session_id:
            raise RuntimeError("Missing MCP session id.")
        _http_post(
            args.url,
            {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
            headers={"mcp-session-id": session_id},
            timeout=args.timeout,
        )
        _, body = _http_post(
            args.url,
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
            headers={"mcp-session-id": session_id},
            timeout=args.timeout,
        )
        payload = _extract_sse_json(body)
        names = {tool["name"] for tool in payload["result"]["tools"]}
        missing = [name for name in required if name not in names]
        if missing:
            print("Missing tools: " + ", ".join(missing))
            return 1
        return 0
    except Exception as exc:
        print(str(exc))
        return 1


def cmd_ngrok_url(args: argparse.Namespace) -> int:
    try:
        public_url = _get_ngrok_public_url(args.port, args.timeout)
        if public_url:
            print(public_url + "/mcp")
            return 0
        return 1
    except Exception:
        return 1


def cmd_ngrok_ready(args: argparse.Namespace) -> int:
    try:
        public_url = _get_ngrok_public_url(args.port, args.timeout)
        if public_url:
            print(public_url)
            return 0
        return 1
    except Exception:
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    mcp_ready = subparsers.add_parser("mcp-ready")
    mcp_ready.add_argument("--url", required=True)
    mcp_ready.add_argument("--timeout", type=float, default=2.0)
    mcp_ready.set_defaults(func=cmd_mcp_ready)

    required_tools = subparsers.add_parser("required-tools")
    required_tools.add_argument("--url", required=True)
    required_tools.add_argument("--required", required=True)
    required_tools.add_argument("--timeout", type=float, default=3.0)
    required_tools.set_defaults(func=cmd_required_tools)

    ngrok_url = subparsers.add_parser("ngrok-url")
    ngrok_url.add_argument("--port", type=int, required=True)
    ngrok_url.add_argument("--timeout", type=float, default=2.0)
    ngrok_url.set_defaults(func=cmd_ngrok_url)

    ngrok_ready = subparsers.add_parser("ngrok-ready")
    ngrok_ready.add_argument("--port", type=int, required=True)
    ngrok_ready.add_argument("--timeout", type=float, default=2.0)
    ngrok_ready.set_defaults(func=cmd_ngrok_ready)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
