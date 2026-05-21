"""Document management endpoints.

Phase 1.5 scope: upload to Cloud Storage + Firestore record. The actual
Vertex AI Search Data Store ingestion will be wired in Phase 1.6 — for now
documents are stored but not yet queryable by Aria.

Access control: only admin+ can upload / delete. Anyone in the business can
list (so future UI can show "what does Aria know?" to all employees).
"""

import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from google.cloud import storage

from app.auth.context import TenantContext
from app.auth.middleware import current_user
from app.config import get_settings
from app.db.firestore import documents_col, tenant_scoped_query
from app.db.models import Document, DocumentListResponse
from app.rag.ingest import ingest_gcs_document

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/csv",
    "image/png",
    "image/jpeg",
    "image/webp",
}
MAX_BYTES = 25 * 1024 * 1024  # 25 MB per file


def _storage() -> storage.Client:
    return storage.Client(project=get_settings().gcp_project_id)


def _ingest_in_background(business_id: str, doc_id: str, gcs_uri: str) -> None:
    """Background task: kick off Discovery Engine ingestion + update doc status."""
    ok = ingest_gcs_document(business_id, gcs_uri)
    ref = documents_col().document(doc_id)
    try:
        if ok:
            ref.update({"status": "processing"})
        else:
            ref.update({"status": "failed", "error": "ingestion call failed"})
    except Exception:
        log.exception("Failed to update doc %s status", doc_id)


@router.post("", response_model=Document, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    ctx: TenantContext = Depends(current_user),
) -> Document:
    business_id = ctx.require_business()
    ctx.require_role("admin")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    body = await file.read()
    if len(body) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_BYTES // (1024 * 1024)} MB limit.",
        )
    if len(body) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file.",
        )

    settings = get_settings()
    doc_id = uuid.uuid4().hex
    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    gcs_path = f"businesses/{business_id}/docs/{doc_id}/{safe_name}"

    bucket = _storage().bucket(settings.gcs_uploads_bucket)
    blob = bucket.blob(gcs_path)
    blob.upload_from_string(body, content_type=file.content_type)

    now = datetime.now(UTC)
    doc = Document(
        id=doc_id,
        business_id=business_id,
        uploaded_by_uid=ctx.uid,
        filename=safe_name,
        content_type=file.content_type,
        size_bytes=len(body),
        gcs_path=gcs_path,
        status="uploaded",
        created_at=now,
    )
    documents_col().document(doc_id).set(doc.model_dump())

    # Kick off Vertex AI Search ingestion in background — caller gets a fast
    # response; the doc's status will flip to "processing" once Discovery
    # Engine accepts the import, and to "ready" after indexing completes.
    gcs_uri = f"gs://{settings.gcs_uploads_bucket}/{gcs_path}"
    background.add_task(_ingest_in_background, business_id, doc_id, gcs_uri)

    return doc


@router.get("", response_model=DocumentListResponse)
async def list_documents(ctx: TenantContext = Depends(current_user)) -> DocumentListResponse:
    business_id = ctx.require_business()
    # Anyone in the business can see what's been uploaded.
    snaps = tenant_scoped_query(documents_col(), business_id).stream()
    docs = [Document(**s.to_dict()) for s in snaps]
    docs.sort(key=lambda d: d.created_at, reverse=True)
    return DocumentListResponse(documents=docs)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: str, ctx: TenantContext = Depends(current_user)) -> None:
    business_id = ctx.require_business()
    ctx.require_role("admin")

    ref = documents_col().document(doc_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    data = snap.to_dict() or {}
    # Tenant guard — can't delete another business's doc even if you know the ID.
    if data.get("business_id") != business_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    settings = get_settings()
    bucket = _storage().bucket(settings.gcs_uploads_bucket)
    try:
        bucket.blob(data["gcs_path"]).delete()
    except Exception:
        # File already gone is OK — proceed with Firestore delete.
        pass

    ref.delete()
