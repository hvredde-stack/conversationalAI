"""Lazy Discovery Engine clients.

Vertex AI Search for unstructured content lives in the 'global' location for
most cases — that's where we put data stores and search engines.
"""

from functools import lru_cache

from google.cloud import discoveryengine_v1 as discoveryengine

# All unstructured data stores live in 'global'.
LOCATION = "global"
COLLECTION = "default_collection"
BRANCH = "default_branch"


@lru_cache(maxsize=1)
def data_store_client() -> discoveryengine.DataStoreServiceClient:
    return discoveryengine.DataStoreServiceClient()


@lru_cache(maxsize=1)
def engine_client() -> discoveryengine.EngineServiceClient:
    return discoveryengine.EngineServiceClient()


@lru_cache(maxsize=1)
def document_client() -> discoveryengine.DocumentServiceClient:
    return discoveryengine.DocumentServiceClient()


@lru_cache(maxsize=1)
def search_client() -> discoveryengine.SearchServiceClient:
    return discoveryengine.SearchServiceClient()


def data_store_id_for(business_id: str) -> str:
    """Derive the per-business Data Store ID.

    business_id is uuid4().hex (32 chars). Prefix gives a stable, readable ID
    that fits Discovery Engine's [a-z0-9][a-z0-9-_]{0,62} constraint.
    """
    return f"biz-{business_id}"


def engine_id_for(business_id: str) -> str:
    return f"biz-{business_id}-engine"


def data_store_parent(project_id: str) -> str:
    return f"projects/{project_id}/locations/{LOCATION}/collections/{COLLECTION}"


def data_store_name(project_id: str, business_id: str) -> str:
    return (
        f"projects/{project_id}/locations/{LOCATION}"
        f"/collections/{COLLECTION}/dataStores/{data_store_id_for(business_id)}"
    )


def branch_name(project_id: str, business_id: str) -> str:
    return f"{data_store_name(project_id, business_id)}/branches/{BRANCH}"


def serving_config_name(project_id: str, business_id: str) -> str:
    """Default serving config exposed on the data store."""
    return f"{data_store_name(project_id, business_id)}/servingConfigs/default_config"


def engine_parent(project_id: str) -> str:
    return f"projects/{project_id}/locations/{LOCATION}/collections/{COLLECTION}"


def engine_name(project_id: str, business_id: str) -> str:
    return (
        f"projects/{project_id}/locations/{LOCATION}"
        f"/collections/{COLLECTION}/engines/{engine_id_for(business_id)}"
    )
