"""Business creation — self-serve. The caller becomes the owner."""

import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.auth.context import TenantContext
from app.auth.firebase import set_custom_claims
from app.auth.middleware import current_user
from app.db.firestore import businesses_col, get_db, users_col
from app.db.models import Business, CreateBusinessRequest, CreateBusinessResponse, UserDoc
from app.rag.client import data_store_id_for
from app.rag.data_store import create_data_store_for_business

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/businesses", tags=["businesses"])


def _provision_rag(business_id: str) -> None:
    """Background task: create the Data Store + Engine for a new business.

    Wrapped in a function so any exception is logged but doesn't propagate
    back to the signup response. Provisioning takes ~5-10 min in GCP.
    """
    try:
        create_data_store_for_business(business_id)
    except Exception:
        log.exception("RAG provisioning failed for business %s", business_id)


@router.post("", response_model=CreateBusinessResponse, status_code=status.HTTP_201_CREATED)
async def create_business(
    payload: CreateBusinessRequest,
    background: BackgroundTasks,
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
    data_store_id = data_store_id_for(business_id)

    business = {
        "id": business_id,
        "name": payload.name,
        "owner_uid": ctx.uid,
        "created_at": now,
        "data_store_id": data_store_id,
        "data_store_ready": False,  # background task flips this when GCP signals ready
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

    # Fire-and-forget Data Store + Engine creation (~5-10 min in background).
    background.add_task(_provision_rag, business_id)

    return CreateBusinessResponse(
        business=Business(**business),
        user=UserDoc(**user_doc),
    )
