"""Create per-business Vertex AI Search Data Store + Search Engine.

Both are long-running operations (~5-10 min combined). We fire-and-forget so
the business signup endpoint returns immediately; the Data Store provisions
in the background. Subsequent ingestion / query calls fail loudly until ready
— callers should handle "not ready" gracefully.
"""

import logging

from google.api_core.exceptions import AlreadyExists
from google.cloud import discoveryengine_v1 as discoveryengine

from app.config import get_settings
from app.rag.client import (
    data_store_client,
    data_store_id_for,
    data_store_parent,
    engine_client,
    engine_id_for,
    engine_parent,
)

log = logging.getLogger(__name__)


def create_data_store_for_business(business_id: str) -> str:
    """Kick off Data Store + Search Engine creation. Non-blocking.

    Returns the Data Store ID. The actual GCP resources may take up to ~10
    minutes to fully provision. Idempotent: returns the existing Data Store
    ID if it's already been created.
    """
    settings = get_settings()
    project = settings.gcp_project_id
    ds_id = data_store_id_for(business_id)
    eng_id = engine_id_for(business_id)

    # 1. Create the Data Store (unstructured, generic vertical)
    data_store = discoveryengine.DataStore(
        display_name=f"Knowledge base for {business_id}",
        industry_vertical=discoveryengine.IndustryVertical.GENERIC,
        solution_types=[discoveryengine.SolutionType.SOLUTION_TYPE_SEARCH],
        content_config=discoveryengine.DataStore.ContentConfig.CONTENT_REQUIRED,
    )
    try:
        data_store_client().create_data_store(
            parent=data_store_parent(project),
            data_store=data_store,
            data_store_id=ds_id,
        )
        log.info("Created Data Store %s (provisioning ~5-10 min)", ds_id)
    except AlreadyExists:
        log.info("Data Store %s already exists; skipping create", ds_id)

    # 2. Create the Search Engine bound to that Data Store
    engine = discoveryengine.Engine(
        display_name=f"Search engine for {business_id}",
        solution_type=discoveryengine.SolutionType.SOLUTION_TYPE_SEARCH,
        industry_vertical=discoveryengine.IndustryVertical.GENERIC,
        data_store_ids=[ds_id],
        search_engine_config=discoveryengine.Engine.SearchEngineConfig(
            search_tier=discoveryengine.SearchTier.SEARCH_TIER_STANDARD,
            search_add_ons=[discoveryengine.SearchAddOn.SEARCH_ADD_ON_LLM],
        ),
    )
    try:
        engine_client().create_engine(
            parent=engine_parent(project),
            engine=engine,
            engine_id=eng_id,
        )
        log.info("Created Search Engine %s", eng_id)
    except AlreadyExists:
        log.info("Engine %s already exists; skipping create", eng_id)
    except Exception:
        # Engine creation can fail if Data Store isn't ready yet. That's OK —
        # we'll create the engine later on first ingestion attempt or accept
        # that retrieval will fail until both are ready.
        log.exception("Engine creation failed (may need retry once Data Store is ready)")

    return ds_id


def is_data_store_ready(business_id: str) -> bool:
    """Check if the Data Store has finished provisioning."""
    settings = get_settings()
    from app.rag.client import data_store_name

    try:
        data_store_client().get_data_store(name=data_store_name(settings.gcp_project_id, business_id))
        return True
    except Exception:
        return False
