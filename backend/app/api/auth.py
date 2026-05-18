"""Auth-related endpoints: /me returns the caller's profile, creating a stub on first sign-in."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app.auth.context import TenantContext
from app.auth.middleware import current_user
from app.db.firestore import users_col
from app.db.models import MeResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=MeResponse)
async def me(ctx: TenantContext = Depends(current_user)) -> MeResponse:
    """Return the caller's profile.

    If this is the user's first call after sign-up, they won't have a business yet
    — the response will say needs_onboarding=True so the frontend can route to the
    "create your business" page.
    """
    user_ref = users_col().document(ctx.uid)
    snap = user_ref.get()

    if not snap.exists:
        # First sign-in — create a minimal stub. business_id and role are set
        # later by /api/businesses (self-serve) or accept-invite flows.
        user_ref.set(
            {
                "uid": ctx.uid,
                "email": ctx.email,
                "business_id": None,
                "role": None,
                "created_at": datetime.now(UTC),
            }
        )

    return MeResponse(
        uid=ctx.uid,
        email=ctx.email,
        business_id=ctx.business_id,
        role=ctx.role,
        needs_onboarding=ctx.business_id is None,
    )
