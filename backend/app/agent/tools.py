"""Core types for the tool system.

A `ToolSpec` is the single shape every tool takes, regardless of how it was
authored (built-in now; webhook / OpenAPI / MCP in later phases). The
orchestrator and dispatcher only ever deal in `ToolSpec`.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from app.auth.context import Role, TenantContext


@dataclass
class ToolContext:
    """Everything a tool executor is allowed to know.

    `tenant` is built from the verified Firebase token — it is the ONLY
    source of `business_id`. Executors must never take `business_id` (or any
    tenant identity) from model-supplied arguments.
    """

    tenant: TenantContext
    business_name: str


@dataclass
class ToolResult:
    """The outcome of running a tool, serialized back to the model."""

    ok: bool
    content: Any = ""  # dict (preferred) or str — fed back as the function response
    error: str | None = None


# An executor is an async callable: (validated args, context) -> result.
ToolExecutor = Callable[[dict, ToolContext], Awaitable[ToolResult]]


@dataclass(frozen=True)
class ToolSpec:
    """A single callable capability exposed to the model."""

    name: str  # function name given to Gemini — must be a valid identifier
    description: str  # how the model decides when to use it
    parameters: dict  # JSON Schema (object) for the arguments
    executor: ToolExecutor
    min_role: Role = "customer"  # lowest role allowed to trigger it
    requires_confirmation: bool = False  # designed-in; unused until a tool needs it
