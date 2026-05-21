"""Tool marketplace endpoints for a business.

Lets a business see every capability its agent has, enable/configure the
webhook tools from the platform catalog, and review recent tool activity.
Configuration is multi-tenant — each business supplies its own URLs and
credentials, scoped by the verified token's business_id.
"""

import logging
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.agent.builtin import BUILTIN_TOOLS
from app.agent.catalog import get_catalog_tool, list_catalog
from app.agent.config_store import get_tool_config, list_tool_configs, save_tool_config
from app.agent.secrets import write_secret
from app.auth.context import TenantContext
from app.auth.middleware import current_user
from app.db.firestore import get_db, tenant_scoped_query
from app.db.models import BusinessToolConfig

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["tools"])


class ToolView(BaseModel):
    tool_id: str
    name: str
    display_name: str
    description: str
    kind: Literal["builtin", "webhook"]
    enabled: bool
    configurable: bool
    min_role: str
    requires_confirmation: bool
    config_schema: dict = {}
    config: dict = {}
    needs_secrets: list[str] = []  # secret keys the tool needs but doesn't have
    has_secrets: list[str] = []  # secret keys already stored


class ToolListResponse(BaseModel):
    tools: list[ToolView]


class UpdateToolRequest(BaseModel):
    enabled: bool
    config: dict = {}
    secrets: dict[str, str] = {}  # secret_key -> plaintext (write-only, never returned)


class ToolCallRecord(BaseModel):
    tool: str
    ok: bool
    error: str | None = None
    latency_ms: int | None = None
    created_at: datetime | None = None


class ToolActivityResponse(BaseModel):
    calls: list[ToolCallRecord]


def _title(name: str) -> str:
    return name.replace("_", " ").title()


def _webhook_view(cat, cfg: BusinessToolConfig | None) -> ToolView:
    secret_key = (
        cat.webhook.auth.secret_key if cat.webhook and cat.webhook.auth else None
    )
    have = set((cfg.secret_refs if cfg else {}).keys())
    needs = [secret_key] if secret_key and secret_key not in have else []
    return ToolView(
        tool_id=cat.tool_id,
        name=cat.name,
        display_name=cat.display_name,
        description=cat.description,
        kind="webhook",
        enabled=bool(cfg and cfg.enabled),
        configurable=True,
        min_role=cat.min_role,
        requires_confirmation=cat.requires_confirmation,
        config_schema=cat.config_schema,
        config=(cfg.config if cfg else {}),
        needs_secrets=needs,
        has_secrets=sorted(have),
    )


@router.get("", response_model=ToolListResponse)
async def list_tools(ctx: TenantContext = Depends(current_user)) -> ToolListResponse:
    """Every capability this business's agent has: always-on built-ins plus the
    catalog webhook tools (enabled or not)."""
    business_id = ctx.require_business()

    views: list[ToolView] = [
        ToolView(
            tool_id=t.name,
            name=t.name,
            display_name=_title(t.name),
            description=t.description,
            kind="builtin",
            enabled=True,
            configurable=False,
            min_role=t.min_role,
            requires_confirmation=t.requires_confirmation,
        )
        for t in BUILTIN_TOOLS
    ]

    configs = {c.tool_id: c for c in list_tool_configs(business_id)}
    for cat in list_catalog():
        if cat.executor_type != "webhook":
            continue
        views.append(_webhook_view(cat, configs.get(cat.tool_id)))

    return ToolListResponse(tools=views)


@router.put("/{tool_id}", response_model=ToolView)
async def update_tool(
    tool_id: str,
    body: UpdateToolRequest,
    ctx: TenantContext = Depends(current_user),
) -> ToolView:
    """Enable/disable and configure a catalog webhook tool for this business."""
    business_id = ctx.require_business()
    ctx.require_role("admin")

    cat = get_catalog_tool(tool_id)
    if cat is None or cat.executor_type != "webhook":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found in the catalog.",
        )

    existing = get_tool_config(business_id, tool_id)
    secret_refs = dict(existing.secret_refs) if existing else {}
    # New secret values go to Secret Manager; only the resource name is stored.
    for key, value in body.secrets.items():
        if value:
            secret_refs[key] = write_secret(business_id, tool_id, key, value)

    cfg = BusinessToolConfig(
        tool_id=tool_id,
        business_id=business_id,
        enabled=body.enabled,
        config=body.config,
        secret_refs=secret_refs,
        updated_at=datetime.now(UTC),
        updated_by_uid=ctx.uid,
    )
    save_tool_config(cfg)
    return _webhook_view(cat, cfg)


@router.get("/activity", response_model=ToolActivityResponse)
async def tool_activity(
    ctx: TenantContext = Depends(current_user),
) -> ToolActivityResponse:
    """Recent tool executions for this business, newest first."""
    business_id = ctx.require_business()

    snaps = tenant_scoped_query(get_db().collection("tool_calls"), business_id)
    records = [
        ToolCallRecord(
            tool=d.get("tool", "?"),
            ok=bool(d.get("ok")),
            error=d.get("error"),
            latency_ms=d.get("latency_ms"),
            created_at=d.get("created_at"),
        )
        for d in (s.to_dict() or {} for s in snaps.limit(500).stream())
    ]
    records.sort(
        key=lambda r: r.created_at or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )
    return ToolActivityResponse(calls=records[:50])
