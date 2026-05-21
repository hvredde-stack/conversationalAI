"""Tool Registry — resolves which tools are available for a given request.

Built-in tools live in code; webhook tools come from the platform catalog,
filtered to the ones the caller's business has enabled (the multi-tenant
marketplace layer). Everything is role-gated.
"""

import asyncio
import logging

from app.agent.builtin import BUILTIN_TOOLS
from app.agent.catalog import list_catalog
from app.agent.config_store import list_tool_configs
from app.agent.tools import ToolContext, ToolResult, ToolSpec
from app.agent.webhook import execute_webhook
from app.auth.context import ROLE_LEVELS, TenantContext
from app.db.models import BusinessToolConfig, CatalogTool

log = logging.getLogger(__name__)


def _webhook_toolspec(catalog: CatalogTool, cfg: BusinessToolConfig) -> ToolSpec:
    """Bind a catalog webhook tool + a business's config into a ToolSpec."""

    async def _executor(args: dict, ctx: ToolContext) -> ToolResult:
        return await execute_webhook(catalog, cfg, args, ctx)

    return ToolSpec(
        name=catalog.name,
        description=catalog.description,
        parameters=catalog.parameters,
        executor=_executor,
        min_role=catalog.min_role,
        requires_confirmation=catalog.requires_confirmation,
    )


def _load_business_tools(
    business_id: str,
) -> list[tuple[CatalogTool, BusinessToolConfig]]:
    """Synchronous Firestore reads — the catalog plus this business's enabled
    tool configs. Run via asyncio.to_thread so the event loop isn't blocked.
    """
    catalog_by_id = {c.tool_id: c for c in list_catalog()}
    pairs: list[tuple[CatalogTool, BusinessToolConfig]] = []
    for cfg in list_tool_configs(business_id):
        if not cfg.enabled:
            continue
        catalog = catalog_by_id.get(cfg.tool_id)
        if catalog is None or catalog.executor_type != "webhook":
            continue
        pairs.append((catalog, cfg))
    return pairs


class ToolRegistry:
    def __init__(self, builtins: list[ToolSpec]) -> None:
        self._builtins = list(builtins)

    async def resolve(self, tenant: TenantContext) -> list[ToolSpec]:
        """Tools available for this request: built-ins plus the webhook tools
        the caller's business has enabled — all gated by the caller's role."""
        level = ROLE_LEVELS.get(tenant.role or "customer", 0)
        tools = [t for t in self._builtins if level >= ROLE_LEVELS[t.min_role]]

        if not tenant.business_id:
            return tools

        try:
            pairs = await asyncio.to_thread(_load_business_tools, tenant.business_id)
        except Exception:
            # A marketplace read failure must not break chat — fall back to
            # built-ins only.
            log.exception("Failed to load business tools for %s", tenant.business_id)
            return tools

        for catalog, cfg in pairs:
            if level >= ROLE_LEVELS[catalog.min_role]:
                tools.append(_webhook_toolspec(catalog, cfg))
        return tools


_registry = ToolRegistry(BUILTIN_TOOLS)


def get_registry() -> ToolRegistry:
    return _registry
