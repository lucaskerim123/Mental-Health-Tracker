#!/usr/bin/env python3
"""
HIS MCP Server — Python / FastMCP / stdio
Health Incident System: substance/medication session tracker.
Runs as a stdio MCP server (for Claude Code).
Set HIS_TRANSPORT=http to run as HTTP on HIS_MCP_PORT (default 8001) instead.

Env vars required:
  SUPABASE_URL  (or NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY
  HIS_USER_ID
"""

from __future__ import annotations

import os

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local", override=False)
    load_dotenv(".env", override=False)
except ImportError:
    pass
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
EVENTS_TABLE   = "session_events"
MOODS_TABLE    = "session_moods"
NOTES_TABLE    = "session_notes"
ENTRIES_TABLE  = "tracker_entries"
SYDNEY         = ZoneInfo("Australia/Sydney")

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

def session_label(session: dict | None) -> str:
    if not session:
        return "Session"
    number = session.get("session_number")
    return f"Session #{number}" if number else f"Session {session.get('id', '')[:8]}"

def incident_label(incident: dict | None) -> str:
    if not incident:
        return "Incident"
    number = incident.get("incident_number")
    return f"Incident #{number}" if number else f"Incident {incident.get('id', '')[:8]}"

async def log_mcp_output(db: AsyncClient, session_id: str | None, content: str, entry_type: str = "mcp_output", incident_id: str | None = None) -> None:
    if not session_id:
        return
    try:
        await (
            db.table(ENTRIES_TABLE)
            .insert({
                "session_id": session_id,
                "content": content,
                "source": "mcp",
                "entry_type": entry_type,
                "visibility": "admin only",
                "incident_id": incident_id,
            })
            .execute()
        )
    except Exception:
        pass

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

async def get_session_events(db: AsyncClient, session_id: str) -> list[dict]:
    resp = await (
        db.table(EVENTS_TABLE)
        .select("*")
        .eq("session_id", session_id)
        .order("occurred_at", desc=False)
        .execute()
    )
    return resp.data or []

async def get_session_moods(db: AsyncClient, session_id: str) -> list[dict]:
    resp = await (
        db.table(MOODS_TABLE)
        .select("*")
        .eq("session_id", session_id)
        .order("occurred_at", desc=False)
        .execute()
    )
    return resp.data or []

async def get_session_notes(db: AsyncClient, session_id: str) -> list[dict]:
    resp = await (
        db.table(NOTES_TABLE)
        .select("*")
        .eq("session_id", session_id)
        .order("occurred_at", desc=False)
        .execute()
    )
    return resp.data or []

async def get_start_iso(db: AsyncClient, session: dict) -> str:
    events = await get_session_events(db, session["id"])
    start = next((e for e in events if e["event_type"] == "START"), None)
    if start:
        return start["occurred_at"]
    if session.get("created_at"):
        return datetime.fromisoformat(session["created_at"]).astimezone(timezone.utc).isoformat()
    ds = session.get("date_start")
    return datetime.fromisoformat(f"{ds}T00:00:00+00:00").isoformat() if ds else now_iso()

async def get_duration_ms(db: AsyncClient, session: dict) -> int:
    events = await get_session_events(db, session["id"])
    start = next((e for e in events if e["event_type"] == "START"), None)
    stop  = next((e for e in reversed(events) if e["event_type"] == "STOP"), None)
    start_ms = int(datetime.fromisoformat(start["occurred_at"]).timestamp() * 1000) if start else 0
    end_ms = (
        int(datetime.fromisoformat(stop["occurred_at"]).timestamp() * 1000)
        if stop else
        int(datetime.now(timezone.utc).timestamp() * 1000)
    )
    return max(0, end_ms - start_ms)

async def get_last_mood(db: AsyncClient, session_id: str) -> str:
    moods = await get_session_moods(db, session_id)
    return moods[-1]["mood"] if moods else "—"

def _ctx(ctx: Context) -> tuple[AsyncClient, str]:
    s = ctx.request_context.lifespan_context
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
        start = await get_start_iso(db, existing)
        dur   = await get_duration_ms(db, existing)
        mood  = await get_last_mood(db, existing["id"])
        moods = await get_session_moods(db, existing["id"])
        notes = await get_session_notes(db, existing["id"])
        return "\n".join([
            "⚠️  Session already active.",
            f"  Session    : {session_label(existing)}",
            f"  UUID       : {existing['id']}",
            f"  Started    : {fmt(start)}",
            f"  Duration   : {ms_to_human(dur)}",
            f"  Mood       : {mood}",
            f"  Moods      : {len(moods)}  Notes: {len(notes)}",
            "",
            "Use /stopsesh to end it first.",
        ])

    session_id = str(uuid.uuid4())
    resp = await (
        db.table(SESSION_TABLE)
        .insert({
            "id": session_id,
            "user_id": uid,
            "date_start": iso_to_date(event_time),
            "sleep_hours": 0,
            "any_incidents": "",
            "personal_reflection": "",
            "notes": "",
            "is_sensitive": False,
        })
        .select("*")
        .execute()
    )
    s = resp.data[0]

    await (
        db.table(EVENTS_TABLE)
        .insert({"session_id": session_id, "event_type": "START", "occurred_at": event_time})
        .execute()
    )

    return "\n".join([
        "✅  Session started.",
        f"  Session    : {session_label(s)}",
        f"  UUID       : {s['id']}",
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

    start = await get_start_iso(db, session)
    dur   = await get_duration_ms(db, session)
    mood  = await get_last_mood(db, session["id"])
    moods = await get_session_moods(db, session["id"])
    notes = await get_session_notes(db, session["id"])

    summary = "\n".join([
        "Session summary:",
        f"  Session      : {session_label(session)}",
        f"  UUID         : {session['id']}",
        f"  Started      : {fmt(start)}",
        f"  Duration     : {ms_to_human(dur)}",
        f"  Sleep logged : {session.get('sleep_hours', 0)}h",
        f"  Mood (last)  : {mood}",
        f"  Moods logged : {len(moods)}",
        f"  Notes logged : {len(notes)}",
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
    await (
        db.table(EVENTS_TABLE)
        .insert({"session_id": session["id"], "event_type": "STOP", "occurred_at": event_time})
        .execute()
    )
    await (
        db.table(SESSION_TABLE)
        .update({"date_end": iso_to_date(event_time)})
        .eq("id", session["id"])
        .execute()
    )

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

    await (
        db.table(SESSION_TABLE)
        .update({"sleep_hours": new_total})
        .eq("id", session["id"])
        .execute()
    )
    await (
        db.table(SLEEP_TABLE)
        .insert({"session_id": session["id"], "hours_added": hours})
        .execute()
    )

    return "\n".join([
        "✅  Sleep logged.",
        f"  Added        : {hours}h",
        f"  Session total: {new_total}h",
        f"  Session      : {session_label(session)}",
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

    resp = await (
        db.table(MOODS_TABLE)
        .insert({"session_id": session["id"], "mood": text, "source": "mcp", "occurred_at": now_iso()})
        .select("*")
        .execute()
    )
    entry = resp.data[0]
    return "\n".join([
        "✅  Mood logged.",
        f"  Mood       : {text}",
        f"  At         : {fmt(entry['occurred_at'])}",
        f"  Session    : {session_label(session)}",
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

    resp = await (
        db.table(NOTES_TABLE)
        .insert({"session_id": session["id"], "note": text, "source": "mcp", "entry_type": "note", "visibility": "counsellor+", "occurred_at": now_iso()})
        .select("*")
        .execute()
    )
    entry = resp.data[0]
    return "\n".join([
        "✅  Note added.",
        f"  Note       : {text}",
        f"  At         : {fmt(entry['occurred_at'])}",
        f"  Session    : {session_label(session)}",
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
    substance: Annotated[Optional[str], Field(description="Substance name. Defaults to ice.", min_length=1)] = "ice",
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
    substance_name = (substance or "ice").strip() or "ice"

    resp = await (
        db.table(LOG_TABLE)
        .insert({
            "session_id": session["id"],
            "substance": substance_name,
            "amount": amount,
            "unit": unit,
            "notes": notes,
        })
        .select("*")
        .execute()
    )
    entry = resp.data[0]
    amount_str = f"{amount} {unit or ''}".strip() if amount is not None else "—"
    output = "\n".join(filter(None, [
        "✅  Use logged.",
        f"  Substance  : {substance_name}",
        f"  Amount     : {amount_str}",
        f"  Notes      : {notes}" if notes else None,
        f"  Logged at  : {fmt(entry.get('logged_at'))}",
        f"  Log ID     : {entry['id']}",
    ]))
    await log_mcp_output(db, session["id"], output, "loguse")
    return output


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
    location: Annotated[Optional[str], Field(description="Incident location.")] = None,
    professional_note: Annotated[Optional[str], Field(description="Note for counsellor or lawyer.")] = None,
    outcome: Annotated[Optional[str], Field(description="Outcome or follow-up.")] = None,
    substance_use: Annotated[Optional[str], Field(description="'no', 'yes', or 'comedown'.")] = None,
    names_involved: Annotated[Optional[str], Field(description="Names of people involved (freetext).")] = None,
    field_visibility: Annotated[Optional[dict], Field(description="Optional per-field visibility map.")] = None,
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
    """
    db, uid = _ctx(ctx)
    event_time = parse_datetime(occurred_at)

    if substance_use and substance_use not in ("no", "yes", "comedown"):
        return "substance_use must be 'no', 'yes', or 'comedown'."

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
            "location": location,
            "professional_note": professional_note,
            "outcome": outcome,
            "is_sensitive": is_sensitive,
            "substance_use": substance_use,
            "names_involved": names_involved,
            "people_involved": [p.strip() for p in names_involved.split(",") if p.strip()] if names_involved else [],
            "field_visibility": field_visibility or {
                "description": "viewer+",
                "notes": "viewer+",
                "personal_notes": "counsellor+",
                "professional_note": "counsellor+",
                "location": "viewer+",
                "people_involved": "viewer+",
                "outcome": "viewer+",
            },
            "emergency_services": emergency_services,
            "police_called": police_called,
            "ambulance_called": ambulance_called,
            "was_arrested": was_arrested,
            "was_sectioned": was_sectioned,
            "tracker_session_id": session_id,
        })
        .select("*")
        .execute()
    )
    inc = resp.data[0]
    flags = [k for k, v in {
        "emergency_services": emergency_services,
        "police_called": police_called,
        "ambulance_called": ambulance_called,
        "was_arrested": was_arrested,
        "was_sectioned": was_sectioned,
    }.items() if v]

    output = "\n".join(filter(None, [
        "✅  Incident created.",
        f"  Incident     : {incident_label(inc)}",
        f"  UUID         : {inc['id']}",
        f"  Occurred     : {fmt(event_time)}",
        f"  Severity     : {severity}/10",
        f"  Description  : {description}",
        f"  Location     : {location}" if location else None,
        f"  Outcome      : {outcome}" if outcome else None,
        f"  Session link : {session_id or '—'}",
        f"  Flags        : {', '.join(flags)}" if flags else None,
        f"  Sensitive    : {'yes' if is_sensitive else 'no'}",
    ]))
    await log_mcp_output(db, session_id, output, "createincident", inc["id"])
    return output


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

    sid = session["id"]
    start  = await get_start_iso(db, session)
    dur    = await get_duration_ms(db, session)
    moods  = await get_session_moods(db, sid)
    notes  = await get_session_notes(db, sid)
    events = await get_session_events(db, sid)

    log_resp = await (
        db.table(LOG_TABLE)
        .select("id", count="exact")
        .eq("session_id", sid)
        .execute()
    )
    log_count = log_resp.count or 0

    inc_resp = await (
        db.table(INCIDENT_TABLE)
        .select("id, incident_number, severity, occurred_at, description")
        .eq("tracker_session_id", sid)
        .order("occurred_at", desc=False)
        .execute()
    )
    incidents = inc_resp.data or []

    lines = [
        "━━━  SESSION REPORT  ━━━",
        f"  Session      : {session_label(session)}",
        f"  UUID         : {sid}",
        f"  Status       : active",
        f"  Started      : {fmt(start)}",
        f"  Duration     : {ms_to_human(dur)}",
        f"  Sleep total  : {session.get('sleep_hours', 0)}h",
        f"  Use log      : {log_count} entries",
        f"  Incidents    : {len(incidents)}",
        "",
        "━━━  EVENTS  ━━━",
    ]
    for e in events:
        lines.append(f"  {fmt(e['occurred_at'])}  [{e['event_type']}]")
    if not events:
        lines.append("  none")

    lines += ["", "━━━  MOODS  ━━━"]
    for m in moods:
        lines.append(f"  {fmt(m['occurred_at'])}  {m['mood']}")
    if not moods:
        lines.append("  none")

    lines += ["", "━━━  NOTES  ━━━"]
    for n in notes:
        lines.append(f"  {fmt(n['occurred_at'])}  {n['note']}")
    if not notes:
        lines.append("  none")

    if incidents:
        lines += ["", "━━━  LINKED INCIDENTS  ━━━"]
        for i in incidents:
            lines.append(f"  {incident_label(i)} [{i['severity']}/10] {fmt(i.get('occurred_at'))}  {i['description'][:60]}")

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
        start  = await get_start_iso(db, s)
        dur    = await get_duration_ms(db, s)
        status = "stopped" if s.get("date_end") else "active"
        lines.append(
            f"  {session_label(s)}"
            f"  {fmt(start)}"
            f"  [{status}]"
            f"  {ms_to_human(dur)}"
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
    """Export a session as a full plain-text report with separate sections for events, moods, notes, substance log, and sleep log.

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

    sid    = session["id"]
    start  = await get_start_iso(db, session)
    dur    = await get_duration_ms(db, session)
    events = await get_session_events(db, sid)
    moods  = await get_session_moods(db, sid)
    notes  = await get_session_notes(db, sid)

    log_resp = await (
        db.table(LOG_TABLE)
        .select("*")
        .eq("session_id", sid)
        .order("logged_at", desc=False)
        .execute()
    )
    log_entries = log_resp.data or []

    sleep_resp = await (
        db.table(SLEEP_TABLE)
        .select("*")
        .eq("session_id", sid)
        .order("logged_at", desc=False)
        .execute()
    )
    sleep_entries = sleep_resp.data or []

    lines = [
        "━━━  SESSION EXPORT  ━━━",
        f"  Session      : {session_label(session)}",
        f"  UUID         : {sid}",
        f"  Status       : {'stopped' if session.get('date_end') else 'active'}",
        f"  Date start   : {session.get('date_start')}",
        f"  Date end     : {session.get('date_end') or '—'}",
        f"  Started      : {fmt(start)}",
        f"  Duration     : {ms_to_human(dur)}",
        f"  Sleep total  : {session.get('sleep_hours', 0)}h",
        "",
        "━━━  EVENTS  ━━━",
    ]
    for e in events:
        lines.append(f"  {fmt(e['occurred_at'])}  [{e['event_type']}]")
    if not events:
        lines.append("  none")

    lines += ["", "━━━  MOODS  ━━━"]
    for m in moods:
        lines.append(f"  {fmt(m['occurred_at'])}  {m['mood']}")
    if not moods:
        lines.append("  none")

    lines += ["", "━━━  NOTES  ━━━"]
    for n in notes:
        lines.append(f"  {fmt(n['occurred_at'])}  {n['note']}")
    if not notes:
        lines.append("  none")

    lines += ["", "━━━  SUBSTANCE LOG  ━━━"]
    for e in log_entries:
        amt = f"{e.get('amount')} {e.get('unit') or ''}".strip() if e.get("amount") is not None else "—"
        line = f"  {fmt(e.get('logged_at'))}  {e.get('substance')}  {amt}"
        if e.get("notes"):
            line += f"  [{e['notes']}]"
        lines.append(line)
    if not log_entries:
        lines.append("  none")

    lines += ["", "━━━  SLEEP LOG  ━━━"]
    for e in sleep_entries:
        lines.append(f"  {fmt(e.get('logged_at'))}  +{e.get('hours_added')}h")
    if not sleep_entries:
        lines.append("  none")

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
  /seshexport [id?]         Full export: events + moods + notes + substance + sleep.

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
    transport = os.environ.get("HIS_TRANSPORT", "stdio")
    if transport == "http":
        port = int(os.environ.get("HIS_MCP_PORT", "8001"))
        mcp.run(transport="streamable-http", port=port)
    else:
        mcp.run(transport="stdio")
