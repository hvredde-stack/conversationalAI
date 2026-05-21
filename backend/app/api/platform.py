"""Platform admin endpoints — cross-tenant view, for the platform owner only.

Authentication: the caller's Firebase custom claim `is_platform_admin: true`
must be set. Use scripts/promote_platform_admin.py to grant a user this claim.

All endpoints are PROTECTED — every read across tenants asserts platform
admin role first. There is no path where a regular business owner can reach
data from another business.
"""

import re
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.agent.catalog import (
    delete_catalog_tool,
    get_catalog_tool,
    list_catalog,
    save_catalog_tool,
)
from app.auth.context import TenantContext
from app.auth.middleware import current_user
from app.db.firestore import businesses_col, documents_col, tenant_scoped_query, users_col
from app.db.models import CatalogTool, Role, WebhookDef

router = APIRouter(prefix="/api/platform", tags=["platform"])


def _require_platform_admin(ctx: TenantContext) -> None:
    if not ctx.is_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin role required.",
        )


class TenantSummary(BaseModel):
    business_id: str
    name: str
    owner_uid: str
    owner_email: str | None
    created_at: datetime
    data_store_id: str | None
    data_store_ready: bool
    user_count: int
    document_count: int


class TenantListResponse(BaseModel):
    tenants: list[TenantSummary]


class TenantDetailResponse(BaseModel):
    tenant: TenantSummary
    users: list[dict[str, Any]]
    documents: list[dict[str, Any]]


@router.get("/me", response_model=dict)
async def platform_me(ctx: TenantContext = Depends(current_user)) -> dict:
    """Lightweight ping so the frontend can detect platform admin status."""
    return {"is_platform_admin": ctx.is_platform_admin, "uid": ctx.uid}


@router.get("/tenants", response_model=TenantListResponse)
async def list_tenants(ctx: TenantContext = Depends(current_user)) -> TenantListResponse:
    _require_platform_admin(ctx)

    biz_snaps = list(businesses_col().stream())
    summaries: list[TenantSummary] = []

    for snap in biz_snaps:
        biz = snap.to_dict() or {}
        business_id = biz.get("id") or snap.id

        # Counts — small businesses for now, fine to count in-process
        users = list(tenant_scoped_query(users_col(), business_id).stream())
        docs = list(tenant_scoped_query(documents_col(), business_id).stream())

        owner_email = None
        for u in users:
            ud = u.to_dict() or {}
            if ud.get("uid") == biz.get("owner_uid"):
                owner_email = ud.get("email")
                break

        summaries.append(
            TenantSummary(
                business_id=business_id,
                name=biz.get("name", "(unnamed)"),
                owner_uid=biz.get("owner_uid", ""),
                owner_email=owner_email,
                created_at=biz.get("created_at"),
                data_store_id=biz.get("data_store_id"),
                data_store_ready=bool(biz.get("data_store_ready", False)),
                user_count=len(users),
                document_count=len(docs),
            )
        )

    summaries.sort(key=lambda t: t.created_at or datetime.min, reverse=True)
    return TenantListResponse(tenants=summaries)


@router.get("/tenants/{business_id}", response_model=TenantDetailResponse)
async def tenant_detail(
    business_id: str,
    ctx: TenantContext = Depends(current_user),
) -> TenantDetailResponse:
    _require_platform_admin(ctx)

    biz_snap = businesses_col().document(business_id).get()
    if not biz_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found.")
    biz = biz_snap.to_dict() or {}

    users = [u.to_dict() for u in tenant_scoped_query(users_col(), business_id).stream()]
    docs = [d.to_dict() for d in tenant_scoped_query(documents_col(), business_id).stream()]

    owner_email = None
    for u in users:
        if u and u.get("uid") == biz.get("owner_uid"):
            owner_email = u.get("email")
            break

    summary = TenantSummary(
        business_id=business_id,
        name=biz.get("name", "(unnamed)"),
        owner_uid=biz.get("owner_uid", ""),
        owner_email=owner_email,
        created_at=biz.get("created_at"),
        data_store_id=biz.get("data_store_id"),
        data_store_ready=bool(biz.get("data_store_ready", False)),
        user_count=len(users),
        document_count=len(docs),
    )

    return TenantDetailResponse(
        tenant=summary,
        users=[u for u in users if u],
        documents=[d for d in docs if d],
    )


# --- Tool catalog management (the marketplace) -------------------------------

_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class CatalogToolUpsert(BaseModel):
    tool_id: str = Field(min_length=1, max_length=64)
    name: str  # function name exposed to Gemini — must be an identifier
    display_name: str
    description: str
    parameters: dict = Field(default_factory=dict)
    webhook: WebhookDef
    config_schema: dict = Field(default_factory=dict)
    min_role: Role = "customer"
    requires_confirmation: bool = False


class CatalogListResponse(BaseModel):
    tools: list[CatalogTool]


@router.get("/catalog", response_model=CatalogListResponse)
async def list_catalog_tools(
    ctx: TenantContext = Depends(current_user),
) -> CatalogListResponse:
    _require_platform_admin(ctx)
    return CatalogListResponse(tools=list_catalog())


@router.post("/catalog", response_model=CatalogTool, status_code=status.HTTP_201_CREATED)
async def upsert_catalog_tool(
    body: CatalogToolUpsert,
    ctx: TenantContext = Depends(current_user),
) -> CatalogTool:
    """Publish (or update) a webhook tool in the marketplace catalog."""
    _require_platform_admin(ctx)
    if not _NAME_RE.match(body.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="name must be a valid identifier (letters, digits, underscore).",
        )
    if not _ID_RE.match(body.tool_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tool_id must be lowercase letters, digits, and hyphens.",
        )

    # Preserve original creation metadata when updating an existing tool.
    existing = get_catalog_tool(body.tool_id)
    tool = CatalogTool(
        tool_id=body.tool_id,
        name=body.name,
        display_name=body.display_name,
        description=body.description,
        parameters=body.parameters,
        executor_type="webhook",
        webhook=body.webhook,
        config_schema=body.config_schema,
        min_role=body.min_role,
        requires_confirmation=body.requires_confirmation,
        created_at=existing.created_at if existing else datetime.now(UTC),
        created_by_uid=existing.created_by_uid if existing else ctx.uid,
    )
    save_catalog_tool(tool)
    return tool


@router.delete("/catalog/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_catalog_tool(
    tool_id: str,
    ctx: TenantContext = Depends(current_user),
) -> None:
    _require_platform_admin(ctx)
    delete_catalog_tool(tool_id)
