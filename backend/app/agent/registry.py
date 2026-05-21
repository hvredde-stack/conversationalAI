"""Tool Registry — resolves which tools are available for a given request.

Phase 1: an in-code registry of built-in tools. Phase 2 adds a Firestore
source (the per-business marketplace catalog) behind this same interface.
"""

from app.agent.builtin import BUILTIN_TOOLS
from app.agent.tools import ToolSpec
from app.auth.context import ROLE_LEVELS, TenantContext


class ToolRegistry:
    def __init__(self, tools: list[ToolSpec]) -> None:
        self._tools = list(tools)

    def resolve(self, tenant: TenantContext) -> list[ToolSpec]:
        """Tools this caller's role is permitted to use.

        Phase 2 also filters by which tools the tenant's business has
        enabled in the marketplace.
        """
        level = ROLE_LEVELS.get(tenant.role or "customer", 0)
        return [t for t in self._tools if level >= ROLE_LEVELS[t.min_role]]


_registry = ToolRegistry(BUILTIN_TOOLS)


def get_registry() -> ToolRegistry:
    return _registry
