"""Audit log for tool executions — the `tool_calls` Firestore collection.

Writes are fire-and-forget: a failed or slow audit write must never block or
break a chat turn.
"""

import asyncio
import logging
from datetime import UTC, datetime

from app.agent.tools import ToolContext, ToolResult
from app.db.firestore import get_db

log = logging.getLogger(__name__)

# Hold references to in-flight write tasks so they aren't garbage-collected
# before completing.
_tasks: set[asyncio.Task] = set()


def _write(doc: dict) -> None:
    try:
        get_db().collection("tool_calls").add(doc)
    except Exception:
        log.warning("tool_calls audit write failed", exc_info=True)


def record(
    ctx: ToolContext,
    tool: str,
    args: dict,
    result: ToolResult,
    latency_ms: int,
) -> None:
    """Schedule an audit write. Never raises, never blocks the caller."""
    doc = {
        "business_id": ctx.tenant.business_id,
        "uid": ctx.tenant.uid,
        "tool": tool,
        "args": args,
        "ok": result.ok,
        "error": result.error,
        "latency_ms": latency_ms,
        "created_at": datetime.now(UTC),
    }
    try:
        task = asyncio.create_task(asyncio.to_thread(_write, doc))
        _tasks.add(task)
        task.add_done_callback(_tasks.discard)
    except RuntimeError:
        # No running event loop (e.g. a unit test) — write inline.
        _write(doc)
