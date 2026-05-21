"""Import a single document (already in GCS) into the business's Data Store."""

import logging

from google.cloud import discoveryengine_v1 as discoveryengine

from app.config import get_settings
from app.rag.client import branch_name, document_client

log = logging.getLogger(__name__)


def ingest_gcs_document(business_id: str, gcs_uri: str) -> bool:
    """Import a single GCS file into the Data Store.

    `gcs_uri` is the gs:// path. Discovery Engine will fetch, extract text,
    chunk, embed, and index the file. Returns True if the import was kicked
    off successfully (the actual indexing is async, ~1-3 min for a single
    doc), False if it errored.
    """
    settings = get_settings()
    parent = branch_name(settings.gcp_project_id, business_id)

    request = discoveryengine.ImportDocumentsRequest(
        parent=parent,
        gcs_source=discoveryengine.GcsSource(
            input_uris=[gcs_uri],
            # 'content' = unstructured files (PDF, DOCX, TXT, HTML, etc.).
            # Discovery Engine extracts + chunks them automatically.
            data_schema="content",
        ),
        reconciliation_mode=discoveryengine.ImportDocumentsRequest.ReconciliationMode.INCREMENTAL,
    )
    try:
        operation = document_client().import_documents(request=request)
        log.info("Ingest started for %s into business %s (op=%s)", gcs_uri, business_id, operation.operation.name)
        return True
    except Exception:
        log.exception("Ingestion failed for %s", gcs_uri)
        return False
