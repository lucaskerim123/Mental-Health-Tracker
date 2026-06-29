from __future__ import annotations

from typing import Annotated, Optional

from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field


def register_lockdown_tool(mcp: FastMCP) -> None:
    @mcp.tool(
        name="lockdown",
        annotations={"readOnlyHint": False, "destructiveHint": True, "idempotentHint": False},
    )
    async def lockdown(
        ctx: Context,
        answer: Annotated[Optional[str], Field(description="Use y to activate, n to cancel. Blank asks for confirmation.")] = None,
    ) -> str:
        """Activate site lockdown using the existing Admin lockdown settings.

        Checks site_config.lockdown_pin_hash first.
        Maps to /lockdown [y|n].
        """
        state = ctx.request_context.lifespan_state
        db = state["db"]
        uid = state["uid"]

        pin_resp = await (
            db.table("site_config")
            .select("value")
            .eq("key", "lockdown_pin_hash")
            .limit(1)
            .execute()
        )
        pin_hash = (pin_resp.data or [{}])[0].get("value")
        if not pin_hash:
            return "Error: No lockdown PIN is set. Set Emergency PIN in Admin > Config first."

        choice = (answer or "").strip().lower()
        if not choice:
            return "Confirm? Y/n"
        if choice in ("n", "no"):
            return "okay fine then"
        if choice not in ("y", "yes"):
            return "Confirm? Y/n"

        await (
            db.table("site_config")
            .upsert({
                "key": "lockdown_mode",
                "value": "true",
                "updated_by": uid,
            })
            .execute()
        )

        try:
            await (
                db.table("activity_logs")
                .insert({
                    "user_id": uid,
                    "action": "lockdown_enable",
                    "resource_type": "site_config",
                    "resource_id": "lockdown_mode",
                    "metadata": {"source": "mcp", "command": "/lockdown y"},
                })
                .execute()
            )
        except Exception:
            pass

        return "Lockdown Mode Activated!"
