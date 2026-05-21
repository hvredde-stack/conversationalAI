"""Platform admin endpoints — cross-tenant view, for the platform owner only.

Authentication: the caller's Firebase custom claim `is_platform_admin: true`
must be set. Use scripts/promote_platform_admin.py to grant a user this claim.

All endpoints are PROTECTED — every read across tenants asserts platform
admin role first. There is no path where a regular business owner can reach
data from another business.
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth.context import TenantContext
from app.auth.middleware import current_user
from app.db.firestore import businesses_col, documents_col, tenant_scoped_query, users_col

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
