"""Tool Dispatcher — validates and executes a single tool call.

Every tool call the model makes passes through here: role gate → argument
validation → execution → audit. A tool failure is returned as a `ToolResult`
(never raised) so the model can see the error and recover.
"""

import logging
import time

import jsonschema

from app.agent.audit import record
from app.agent.tools import ToolContext, ToolResult, ToolSpec

log = logging.getLogger(__name__)


async def execute(
    name: str,
    args: dict,
    by_name: dict[str, ToolSpec],
    ctx: ToolContext,
) -> ToolResult:
    """Run the named tool with model-supplied `args`."""
    spec = by_name.get(name)
    if spec is None:
        # The model hallucinated a tool name, or one was removed mid-conversation.
        return ToolResult(ok=False, error=f"Unknown tool: {name}")

    # Role gate — the model can request a tool the caller may not use.
    try:
        ctx.tenant.require_role(spec.min_role)
    except PermissionError as e:
        return ToolResult(ok=False, error=str(e))

    # Validate model-supplied arguments against the tool's JSON Schema before
    # the executor ever sees them.
    try:
        jsonschema.validate(args, spec.parameters)
    except jsonschema.ValidationError as e:
        return ToolResult(ok=False, error=f"Invalid arguments: {e.message}")

    t0 = time.monotonic()
    try:
        result = await spec.executor(args, ctx)
    except Exception as e:  # noqa: BLE001 — tool failures must not crash the turn
        log.exception("Tool '%s' raised", name)
        result = ToolResult(ok=False, error=str(e))
    latency_ms = int((time.monotonic() - t0) * 1000)

    record(ctx, name, args, result, latency_ms)
    return result
