"""Business creation — self-serve. The caller becomes the owner."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from google.cloud import firestore

from app.auth.context import TenantContext
from app.auth.firebase import set_custom_claims
from app.auth.middleware import current_user
from app.db.firestore import businesses_col, get_db, users_col
from app.db.models import Business, CreateBusinessRequest, CreateBusinessResponse, UserDoc

router = APIRouter(prefix="/api/businesses", tags=["businesses"])


@router.post("", response_model=CreateBusinessResponse, status_code=status.HTTP_201_CREATED)
async def create_business(
    payload: CreateBusinessRequest,
    ctx: TenantContext = Depends(current_user),
) -> CreateBusinessResponse:
    """Create a business with the caller as owner.

    Fails if the caller already belongs to a business — switch businesses /
    multi-org is a future concern.
    """
    if ctx.business_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already belong to a business.",
        )
    if not ctx.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account must have a verified email.",
        )

    business_id = uuid.uuid4().hex
    now = datetime.now(UTC)

    business = {
        "id": business_id,
        "name": payload.name,
        "owner_uid": ctx.uid,
        "created_at": now,
        "data_store_id": None,
        "data_store_ready": False,
        "widget_api_key": None,
    }
    user_doc = {
        "uid": ctx.uid,
        "business_id": business_id,
        "role": "owner",
        "email": ctx.email,
        "created_at": now,
    }

    # Write both atomically so a half-created state can't exist.
    batch = get_db().batch()
    batch.set(businesses_col().document(business_id), business)
    batch.set(users_col().document(ctx.uid), user_doc, merge=True)
    batch.commit()

    # Mirror business_id + role into the user's Firebase custom claims so
    # subsequent requests have them in the verified token. Client must force
    # an ID token refresh after this call (handled in frontend).
    set_custom_claims(ctx.uid, {"business_id": business_id, "role": "owner"})

    return CreateBusinessResponse(
        business=Business(**business),
        user=UserDoc(**user_doc),
    )
