#!/usr/bin/env python3
"""
HIS MCP Server — Python / FastMCP / HTTP
Health Incident System: substance/medication session tracker.
Port 8001. No pause state — sessions are active or stopped.

Env vars required:
  SUPABASE_URL  (or NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY
  HIS_USER_ID
  HIS_MCP_PORT  (optional, default 8001)
"""

from __future__ import annotations

import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated, Optional
from zoneinfo import ZoneInfo

from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field
from supabase import AsyncClient, acreate_client

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SESSION_TABLE  = "drug_tracker_sessions"
LOG_TABLE      = "drug_use_log"
INCIDENT_TABLE = "mental_health_incidents"
SLEEP_TABLE    = "sleep_log"
SYDNEY         = ZoneInfo("Australia/Sydney")

HIS_PATTERN = re.compile(
    r"^\[HIS:(?P<type>START|STOP|NOTE|MOOD)\]\s+"
    r"(?P<at>[^\n]+?)(?:\s+::\s*(?P<text>.*))?$",
    re.MULTILINE,
)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

def _require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val

def _supabase_url() -> str:
    return (
        os.environ.get("SUPABASE_URL", "").strip()
        or _require_env("NEXT_PUBLIC_SUPABASE_URL")
    )

@asynccontextmanager
async def lifespan(server: FastMCP):
    db: AsyncClient = await acreate_client(
        _supabase_url(),
        _require_env("SUPABASE_SERVICE_ROLE_KEY"),
    )
    yield {"db": db, "uid": _require_env("HIS_USER_ID")}

mcp = FastMCP("his_mcp", lifespan=lifespan)

# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def parse_datetime(value: str | None) -> str:
    if not value or not value.strip():
        return now_iso()
    try:
        return datetime.fromisoformat(value).astimezone(timezone.utc).isoformat()
    except ValueError as exc:
        raise ValueError(
            f"Invalid datetime {value!r}. Use ISO 8601, e.g. 2026-06-28T21:00:00+10:00."
        ) from exc

def iso_to_date(iso: str) -> str:
    return iso[:10]

def fmt(iso: str | None) -> str:
    """Format ISO timestamp for display in Sydney time."""
    if not iso:
        return "—"
    return datetime.fromisoformat(iso).astimezone(SYDNEY).strftime("%d %b %Y %H:%M:%S")

def ms_to_human(ms: int) -> str:
    s = max(0, ms // 1000)
    d, s = divmod(s, 86400)
    h, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    if d: return f"{d}d {h}h {m}m"
    if h: return f"{h}h {m}m {s}s"
    if m: return f"{m}m {s}s"
    return f"{s}s"

# ---------------------------------------------------------------------------
# HIS event log (stored in drug_tracker_sessions.notes)
# ---------------------------------------------------------------------------

def his_line(event_type: str, at: str, body: str | None = None) -> str:
    safe = (body or "").replace("\n", " ").strip()
    return f"[HIS:{event_type}] {at} :: {safe}" if safe else f"[HIS:{event_type}] {at}"

def append_his(notes: str | None, event_type: str, at: str, body: str | None = None) -> str:
    existing = (notes or "").rstrip()
    line = his_line(event_type, at, body)
    return f"{existing}\n{line}" if existing else line

def parse_events(notes: str | None) -> list[dict]:
    events: list[dict] = []
    for m in HIS_PATTERN.finditer(notes or ""):
        try:
            at = datetime.fromisoformat(m.group("at").strip()).astimezone(timezone.utc).isoformat()
        except ValueError:
            continue
        events.append({"type": m.group("type"), "at": at, "text": (m.group("text") or "").strip()})
    return events

def get_start_iso(session: dict, events: list[dict] | None = None) -> str:
    if events is None:
        events = parse_events(session.get("notes"))
    start = next((e for e in events if e["type"] == "START"), None)
    if start:
        return start["at"]
    if session.get("created_at"):
        return datetime.fromisoformat(session["created_at"]).astimezone(timezone.utc).isoformat()
    ds = session.get("date_start")
    return datetime.fromisoformat(f"{ds}T00:00:00+00:00").isoformat() if ds else now_iso()

def is_stopped(session: dict) -> bool:
    return bool(session.get("date_end"))

def duration_ms(session: dict) -> int:
    events = parse_events(session.get("notes"))
    start_ms = int(datetime.fromisoformat(get_start_iso(session, events)).timestamp() * 1000)
    stops = [e for e in events if e["type"] == "STOP"]
    end_ms = (
        int(datetime.fromisoformat(stops[-1]["at"]).timestamp() * 1000)
        if stops else
        int(datetime.now(timezone.utc).timestamp() * 1000)
    )
    return max(0, end_ms - start_ms)

def last_mood(events: list[dict]) -> str:
    moods = [e for e in events if e["type"] == "MOOD"]
    return moods[-1]["text"] if moods else "—"

def recent_events(session: dict, n: int = 5) -> str:
    events = parse_events(session.get("notes"))[-n:]
    if not events:
        return "  none"
    return "\n".join(f"  {fmt(e['at'])}  [{e['type']}]  {e['text']}" for e in reversed(events))

# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

async def current_session(db: AsyncClient, uid: str) -> dict | None:
    resp = await (
        db.table(SESSION_TABLE)
        .select("*")
        .eq("user_id", uid)
        .is_("date_end", "null")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None

async def latest_session(db: AsyncClient, uid: str) -> dict | None:
    resp = await (
        db.table(SESSION_TABLE)
        .select("*")
        .eq("user_id", uid)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None

async def set_notes(db: AsyncClient, session_id: str, notes: str) -> dict:
    resp = await (
        db.table(SESSION_TABLE)
        .update({"notes": notes})
        .eq("id", session_id)
        .select("*")
        .single()
        .execute()
    )
    return resp.data

def _ctx(ctx: Context) -> tuple[AsyncClient, str]:
    s = ctx.request_context.lifespan_state
    return s["db"], s["uid"]

# ---------------------------------------------------------------------------
# /startsesh
# ---------------------------------------------------------------------------

@mcp.tool(
    name="startsesh",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
)
async def startsesh(
    ctx: Context,
    at: Annotated[Optional[str], Field(description="Optional ISO datetime override. Blank = now.")] = None,
) -> str:
    """Start a new tracker session. If one is already active, returns its current state instead.

    Maps to /startsesh [at?].
    """
    db, uid = _ctx(ctx)
    event_time = parse_datetime(at)
    existing = await current_session(db, uid)

    if existing:
        events = parse_events(existing.get("notes"))
        return "\n".join([
            "⚠️  Session already active.",
            f"  Session ID : {existing['id']}",
            f"  Started    : {fmt(get_start_iso(existing, events))}",
            f"  Duration   : {ms_to_human(duration_ms(existing))}",
            f"  Mood       : {last_mood(events)}",
            f"  Entries    : {len(events)}",
            "",
            "Use /stopsesh to end it first.",
        ])

    start_notes = his_line("START", event_time, "Session started.")
    resp = await (
        db.table(SESSION_TABLE)
        .insert({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "date_start": iso_to_date(event_time),
            "sleep_hours": 0,
            "any_incidents": "",
            "personal_reflection": "",
            "notes": start_notes,
            "is_sensitive": False,
        })
        .select("*")
        .single()
        .execute()
    )
    s = resp.data
    return "\n".join([
        "✅  Session started.",
        f"  Session ID : {s['id']}",
        f"  Started    : {fmt(event_time)}",
        f"  Date       : {s['date_start']}",
    ])


# ---------------------------------------------------------------------------
# /stopsesh
# ---------------------------------------------------------------------------

@mcp.tool(
    name="stopsesh",
    annotations={"readOnlyHint": False, "destructiveHint": True, "idempotentHint": False},
)
async def stopsesh(
    ctx: Context,
    confirm: Annotated[bool, Field(description="Must be true to actually stop. Call without confirm=true first to see a summary.")] = False,
) -> str:
    """Stop and save the current session. Call once to preview what will be saved, then again with confirm=true to commit.

    Maps to /stopsesh [confirm?].
    """
    db, uid = _ctx(ctx)
    session = await current_session(db, uid)

    if not session:
        return "No active session found. Use /startsesh to begin one."

    events = parse_events(session.get("notes"))
    summary = "\n".join([
        "Session summary:",
        f"  Session ID   : {session['id']}",
        f"  Started      : {fmt(get_start_iso(session, events))}",
        f"  Duration     : {ms_to_human(duration_ms(session))}",
        f"  Sleep logged : {session.get('sleep_hours', 0)}h",
        f"  Mood         : {last_mood(events)}",
        f"  Entries      : {len(events)}",
    ])

    if not confirm:
        return "\n".join([
            "⚠️  About to stop and save this session.",
            "",
            summary,
            "",
            "Call /stopsesh confirm=true to commit.",
        ])

    event_time = now_iso()
    next_notes = append_his(session.get("notes"), "STOP", event_time, "Session stopped.")
    resp = await (
        db.table(SESSION_TABLE)
        .update({"notes": next_notes, "date_end": iso_to_date(event_time)})
        .eq("id", session["id"])
        .select("*")
        .single()
        .execute()
    )
    stopped = resp.data
    return "\n".join([
        "✅  Session stopped and saved.",
        "",
        summary,
        f"  Stopped      : {fmt(event_time)}",
    ])


# ---------------------------------------------------------------------------
# /addsleep
# ---------------------------------------------------------------------------

@mcp.tool(
    name="addsleep",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
)
async def addsleep(
    ctx: Context,
    hours: Annotated[float, Field(description="Hours of sleep to log (e.g. 7.5).", gt=0, le=24)],
) -> str:
    """Log sleep hours to the current session. Adds to the running sleep_hours total and writes an audit row to sleep_log.

    Maps to /addsleep [hours].
    """
    db, uid = _ctx(ctx)
    session = await current_session(db, uid)
    if not session:
        return "No active session. Use /startsesh first."

    new_total = float(session.get("sleep_hours") or 0) + hours

    # Update running total on session
    await (
        db.table(SESSION_TABLE)
        .update({"sleep_hours": new_total})
        .eq("id", session["id"])
        .execute()
    )

    # Audit row in sleep_log
    await (
        db.table(SLEEP_TABLE)
        .insert({"session_id": session["id"], "hours_added": hours})
        .execute()
    )

    return "\n".join([
        "✅  Sleep logged.",
        f"  Added        : {hours}h",
        f"  Session total: {new_total}h",
        f"  Session ID   : {session['id']}",
    ])


# ---------------------------------------------------------------------------
# /moodadd
# ---------------------------------------------------------------------------

@mcp.tool(
    name="moodadd",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
)
async def moodadd(
    ctx: Context,
    text: Annotated[str, Field(description="Mood description, e.g. 'anxious', 'flat', 'wired, can't sleep'.", min_length=1)],
) -> str:
    """Add a mood entry to the current session.

    Maps to /moodadd [text].
    """
    db, uid = _ctx(ctx)
    session = await current_session(db, uid)
    if not session:
        return "No active session. Use /startsesh first."

    next_notes = append_his(session.get("notes"), "MOOD", now_iso(), text)
    updated = await set_notes(db, session["id"], next_notes)
    return "\n".join([
        "✅  Mood logged.",
        f"  Mood       : {text}",
        f"  Session ID : {updated['id']}",
    ])


# ---------------------------------------------------------------------------
# /addnote
# ---------------------------------------------------------------------------

@mcp.tool(
    name="addnote",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
)
async def addnote(
    ctx: Context,
    text: Annotated[str, Field(description="Note to attach to the current session.", min_length=1)],
) -> str:
    """Add a freeform note to the current session.

    Maps to /addnote [text].
    """
    db, uid = _ctx(ctx)
    session = await current_session(db, uid)
    if not session:
        return "No active session. Use /startsesh first."

    next_notes = append_his(session.get("notes"), "NOTE", now_iso(), text)
    updated = await set_notes(db, session["id"], next_notes)
    return "\n".join([
        "✅  Note added.",
        f"  Note       : {text}",
        f"  Session ID : {updated['id']}",
    ])


# ---------------------------------------------------------------------------
# /loguse
# ---------------------------------------------------------------------------

@mcp.tool(
    name="loguse",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
)
async def loguse(
    ctx: Context,
    substance: Annotated[str, Field(description="Substance name, e.g. meth, cannabis, alcohol.", min_length=1)],
    amount: Annotated[Optional[float], Field(description="Quantity, e.g. 0.1", ge=0)] = None,
    unit: Annotated[Optional[str], Field(description="Unit, e.g. g, mg, ml, standard.")] = None,
    notes: Annotated[Optional[str], Field(description="Optional extra notes.")] = None,
) -> str:
    """Log a substance use entry to drug_use_log for the current session.

    Maps to /loguse [substance] [amount?] [unit?] [notes?].
    """
    db, uid = _ctx(ctx)
    session = await current_session(db, uid)
    if not session:
        return "No active session. Use /startsesh first."

    resp = await (
        db.table(LOG_TABLE)
        .insert({
            "session_id": session["id"],
            "substance": substance,
            "amount": amount,
            "unit": unit,
            "notes": notes,
        })
        .select("*")
        .single()
        .execute()
    )
    entry = resp.data
    amount_str = f"{amount} {unit or ''}".strip() if amount is not None else "—"
    return "\n".join(filter(None, [
        "✅  Use logged.",
        f"  Substance  : {substance}",
        f"  Amount     : {amount_str}",
        f"  Notes      : {notes}" if notes else None,
        f"  Logged at  : {fmt(entry.get('logged_at'))}",
        f"  Log ID     : {entry['id']}",
    ]))


# ---------------------------------------------------------------------------
# /createincident
# ---------------------------------------------------------------------------

@mcp.tool(
    name="createincident",
    annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False},
)
async def createincident(
    ctx: Context,
    severity: Annotated[int, Field(description="Severity 1 (minor) to 10 (crisis).", ge=1, le=10)],
    description: Annotated[str, Field(description="What happened.", min_length=1)],
    occurred_at: Annotated[Optional[str], Field(description="ISO datetime. Blank = now.")] = None,
    personal_notes: Annotated[Optional[str], Field(description="Private notes (sensitive field).")] = None,
    notes: Annotated[Optional[str], Field(description="General notes.")] = None,
    substance_use: Annotated[Optional[str], Field(description="'no', 'yes', or 'comedown'.")] = None,
    names_involved: Annotated[Optional[str], Field(description="Names of people involved (freetext).")] = None,
    is_sensitive: Annotated[bool, Field(description="Mark as sensitive (hidden from viewer role).")] = False,
    emergency_services: Annotated[bool, Field(description="Were emergency services involved?")] = False,
    police_called: Annotated[bool, Field(description="Was police called?")] = False,
    ambulance_called: Annotated[bool, Field(description="Was ambulance called?")] = False,
    was_arrested: Annotated[bool, Field(description="Were you arrested?")] = False,
    was_sectioned: Annotated[bool, Field(description="Were you sectioned?")] = False,
    link_session: Annotated[bool, Field(description="Auto-link to current active session if one exists.")] = True,
) -> str:
    """Create a mental health incident record in mental_health_incidents.

    Maps to /createincident. Required: severity, description.
    Optional: everything else. Auto-links to the active session when link_session=true.
    """
    db, uid = _ctx(ctx)
    event_time = parse_datetime(occurred_at)

    # Validate substance_use enum
    if substance_use and substance_use not in ("no", "yes", "comedown"):
        return "substance_use must be 'no', 'yes', or 'comedown'."

    # Auto-link to current session
    session_id: str | None = None
    if link_session:
        session = await current_session(db, uid)
        if session:
            session_id = session["id"]

    resp = await (
        db.table(INCIDENT_TABLE)
        .insert({
            "user_id": uid,
            "occurred_at": event_time,
            "severity": severity,
            "description": description,
            "personal_notes": personal_notes,
            "notes": notes,
            "is_sensitive": is_sensitive,
            "substance_use": substance_use,
            "names_involved": names_involved,
            "emergency_services": emergency_services,
            "police_called": police_called,
            "ambulance_called": ambulance_called,
            "was_arrested": was_arrested,
            "was_sectioned": was_sectioned,
            "tracker_session_id": session_id,
        })
        .select("*")
        .single()
        .execute()
    )
    inc = resp.data
    flags = [k for k, v in {
        "emergency_services": emergency_services,
        "police_called": police_called,
        "ambulance_called": ambulance_called,
        "was_arrested": was_arrested,
        "was_sectioned": was_sectioned,
    }.items() if v]

    return "\n".join(filter(None, [
        "✅  Incident created.",
        f"  Incident ID  : {inc['id']}",
        f"  Occurred     : {fmt(event_time)}",
        f"  Severity     : {severity}/10",
        f"  Description  : {description}",
        f"  Session link : {session_id or '—'}",
        f"  Flags        : {', '.join(flags)}" if flags else None,
        f"  Sensitive    : {'yes' if is_sensitive else 'no'}",
    ]))


# ---------------------------------------------------------------------------
# /seshinfo
# ---------------------------------------------------------------------------

@mcp.tool(
    name="seshinfo",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
)
async def seshinfo(ctx: Context) -> str:
    """Output a full report on the current active session.

    Maps to /seshinfo.
    """
    db, uid = _ctx(ctx)
    session = await current_session(db, uid)
    if not session:
        return "No active session. Use /startsesh to begin one."

    events = parse_events(session.get("notes"))

    # Substance log count
    log_resp = await (
        db.table(LOG_TABLE)
        .select("id", count="exact")
        .eq("session_id", session["id"])
        .execute()
    )
    log_count = log_resp.count or 0

    # Incidents linked to this session
    inc_resp = await (
        db.table(INCIDENT_TABLE)
        .select("id, severity, occurred_at, description")
        .eq("tracker_session_id", session["id"])
        .order("occurred_at", desc=False)
        .execute()
    )
    incidents = inc_resp.data or []

    lines = [
        "━━━  SESSION REPORT  ━━━",
        f"  ID           : {session['id']}",
        f"  Status       : active",
        f"  Started      : {fmt(get_start_iso(session, events))}",
        f"  Duration     : {ms_to_human(duration_ms(session))}",
        f"  Sleep total  : {session.get('sleep_hours', 0)}h",
        f"  Mood (last)  : {last_mood(events)}",
        f"  Use log      : {log_count} entries",
        f"  Incidents    : {len(incidents)}",
        "",
        "Recent activity:",
        recent_events(session, 5),
    ]

    if incidents:
        lines += ["", "Linked incidents:"]
        for i in incidents:
            lines.append(f"  [{i['severity']}/10] {fmt(i.get('occurred_at'))}  {i['description'][:60]}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# /seshlist
# ---------------------------------------------------------------------------

@mcp.tool(
    name="seshlist",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
)
async def seshlist(
    ctx: Context,
    limit: Annotated[Optional[int], Field(description="Max sessions to return. Default 5.", ge=1, le=20)] = 5,
) -> str:
    """List recent sessions with status, duration, and sleep totals.

    Maps to /seshlist [limit?].
    """
    db, uid = _ctx(ctx)
    resp = await (
        db.table(SESSION_TABLE)
        .select("*")
        .eq("user_id", uid)
        .order("created_at", desc=True)
        .limit(limit or 5)
        .execute()
    )
    sessions = resp.data or []
    if not sessions:
        return "No sessions found."

    lines = ["Recent sessions:"]
    for s in sessions:
        events = parse_events(s.get("notes"))
        status = "stopped" if is_stopped(s) else "active"
        lines.append(
            f"  {fmt(get_start_iso(s, events))}"
            f"  [{status}]"
            f"  {ms_to_human(duration_ms(s))}"
            f"  sleep={s.get('sleep_hours', 0)}h"
            f"  {s['id']}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# /seshexport
# ---------------------------------------------------------------------------

@mcp.tool(
    name="seshexport",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
)
async def seshexport(
    ctx: Context,
    session_id: Annotated[Optional[str], Field(description="Session UUID. Blank = current or latest.")] = None,
) -> str:
    """Export a session as a full plain-text timeline including all events and substance log.

    Maps to /seshexport [session_id?].
    """
    db, uid = _ctx(ctx)

    if session_id:
        resp = await db.table(SESSION_TABLE).select("*").eq("id", session_id).limit(1).execute()
        session = resp.data[0] if resp.data else None
    else:
        session = await current_session(db, uid) or await latest_session(db, uid)

    if not session:
        return "No session found."

    events = parse_events(session.get("notes"))

    log_resp = await (
        db.table(LOG_TABLE)
        .select("*")
        .eq("session_id", session["id"])
        .order("logged_at", desc=False)
        .execute()
    )
    log_entries = log_resp.data or []

    sleep_resp = await (
        db.table(SLEEP_TABLE)
        .select("*")
        .eq("session_id", session["id"])
        .order("logged_at", desc=False)
        .execute()
    )
    sleep_entries = sleep_resp.data or []

    lines = [
        "━━━  SESSION EXPORT  ━━━",
        f"  Session ID   : {session['id']}",
        f"  Status       : {'stopped' if is_stopped(session) else 'active'}",
        f"  Date start   : {session.get('date_start')}",
        f"  Date end     : {session.get('date_end') or '—'}",
        f"  Started      : {fmt(get_start_iso(session, events))}",
        f"  Duration     : {ms_to_human(duration_ms(session))}",
        f"  Sleep total  : {session.get('sleep_hours', 0)}h",
        "",
        "Event timeline:",
    ]
    for e in events:
        lines.append(f"  {fmt(e['at'])}  [{e['type']}]  {e['text']}")
    if not events:
        lines.append("  none")

    lines += ["", "Substance log:"]
    for e in log_entries:
        amt = f"{e.get('amount')} {e.get('unit') or ''}".strip() if e.get("amount") is not None else "—"
        lines.append(f"  {fmt(e.get('logged_at'))}  {e.get('substance')}  {amt}")
    if not log_entries:
        lines.append("  none")

    lines += ["", "Sleep log:"]
    for e in sleep_entries:
        lines.append(f"  {fmt(e.get('logged_at'))}  +{e.get('hours_added')}h")
    if not sleep_entries:
        lines.append("  none")

    lines += ["", "Raw notes:", session.get("notes") or "none"]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# /usehistory
# ---------------------------------------------------------------------------

@mcp.tool(
    name="usehistory",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
)
async def usehistory(
    ctx: Context,
    session_id: Annotated[Optional[str], Field(description="Session UUID. Blank = current or latest.")] = None,
    limit: Annotated[Optional[int], Field(description="Max entries. Default 20.", ge=1, le=100)] = 20,
) -> str:
    """List substance use log entries for a session.

    Maps to /usehistory [session_id?] [limit?].
    """
    db, uid = _ctx(ctx)

    if session_id:
        target_id = session_id
    else:
        s = await current_session(db, uid) or await latest_session(db, uid)
        target_id = s["id"] if s else None

    if not target_id:
        return "No session found."

    resp = await (
        db.table(LOG_TABLE)
        .select("*")
        .eq("session_id", target_id)
        .order("logged_at", desc=False)
        .limit(limit or 20)
        .execute()
    )
    entries = resp.data or []
    if not entries:
        return f"No substance log entries for session {target_id}."

    lines = [f"Substance log — session {target_id}:"]
    for e in entries:
        amt = f"{e.get('amount')} {e.get('unit') or ''}".strip() if e.get("amount") is not None else "—"
        line = f"  {fmt(e.get('logged_at'))}  {e.get('substance')}  {amt}"
        if e.get("notes"):
            line += f"  [{e['notes']}]"
        lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# /help
# ---------------------------------------------------------------------------

@mcp.tool(
    name="help",
    annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True},
)
async def help(ctx: Context) -> str:
    """Show all available HIS commands."""
    return """━━━  HIS COMMANDS  ━━━

Session:
  /startsesh [at?]          Start a new session. at = optional ISO datetime.
  /stopsesh                 Preview what will be saved.
  /stopsesh confirm=true    Confirm and save the session.
  /seshinfo                 Full report on the current session.
  /seshlist [limit?]        List recent sessions (default 5).
  /seshexport [id?]         Full export: events + substance log + sleep log.

Logging:
  /addsleep [hours]         Log sleep hours (e.g. /addsleep 7.5).
  /moodadd [text]           Add a mood entry (e.g. /moodadd anxious, flat).
  /addnote [text]           Add a freeform note.
  /loguse [sub] [amt?] [unit?] [notes?]
                            Log substance use to drug_use_log.
  /usehistory [id?]         List substance log entries for a session.

Incidents:
  /createincident           Log a mental health incident.
    Required: severity (1-10), description
    Optional: occurred_at, personal_notes, notes, substance_use,
              names_involved, is_sensitive, emergency_services,
              police_called, ambulance_called, was_arrested,
              was_sectioned, link_session

  /help                     This message.

All timestamps display in Sydney time (AEST/AEDT).
"""


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("HIS_MCP_PORT", "8001"))
    mcp.run(transport="streamable-http", port=port)
