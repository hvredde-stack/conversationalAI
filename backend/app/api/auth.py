"""Auth-related endpoints: /me returns the caller's profile, creating a stub on first sign-in."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends

from app.auth.context import TenantContext
from app.auth.middleware import current_user
from app.db.firestore import businesses_col, users_col
from app.db.models import MeResponse
from app.rag.client import data_store_id_for
from app.rag.data_store import create_data_store_for_business

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _backfill_data_store(business_id: str) -> None:
    """Self-healing background task: create a Data Store for businesses
    that were created before the RAG pipeline was wired in."""
    try:
        create_data_store_for_business(business_id)
        businesses_col().document(business_id).update(
            {"data_store_id": data_store_id_for(business_id)}
        )
        log.info("Backfilled Data Store for business %s", business_id)
    except Exception:
        log.exception("Backfill failed for business %s", business_id)


@router.get("/me", response_model=MeResponse)
async def me(
    background: BackgroundTasks,
    ctx: TenantContext = Depends(current_user),
) -> MeResponse:
    """Return the caller's profile.

    If this is the user's first call after sign-up, they won't have a business yet
    — the response will say needs_onboarding=True so the frontend can route to the
    "create your business" page.
    """
    user_ref = users_col().document(ctx.uid)
    snap = user_ref.get()

    if not snap.exists:
        user_ref.set(
            {
                "uid": ctx.uid,
                "email": ctx.email,
                "business_id": None,
                "role": None,
                "created_at": datetime.now(UTC),
            }
        )

    # Self-heal: if user belongs to a business that was created before the RAG
    # pipeline was wired in, kick off Data Store creation in the background.
    if ctx.business_id:
        biz_snap = businesses_col().document(ctx.business_id).get()
        biz_data = biz_snap.to_dict() if biz_snap.exists else None
        if biz_data and not biz_data.get("data_store_id"):
            background.add_task(_backfill_data_store, ctx.business_id)

    return MeResponse(
        uid=ctx.uid,
        email=ctx.email,
        business_id=ctx.business_id,
        role=ctx.role,
        needs_onboarding=ctx.business_id is None,
        is_platform_admin=ctx.is_platform_admin,
    )
