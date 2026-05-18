"""Firestore client + tenant-scoped helpers.

All reads of tenant-owned data MUST go through tenant_collection() so the
business_id filter is applied at the source. Bypassing this is a data-leak bug.
"""

from functools import lru_cache

from google.cloud import firestore

from app.config import get_settings


@lru_cache(maxsize=1)
def get_db() -> firestore.Client:
    settings = get_settings()
    return firestore.Client(project=settings.gcp_project_id)


# Top-level collection helpers ------------------------------------------------

def businesses_col() -> firestore.CollectionReference:
    return get_db().collection("businesses")


def users_col() -> firestore.CollectionReference:
    return get_db().collection("users")


def invites_col() -> firestore.CollectionReference:
    return get_db().collection("invites")


def conversations_col() -> firestore.CollectionReference:
    return get_db().collection("conversations")


def documents_col() -> firestore.CollectionReference:
    return get_db().collection("documents")


def tenant_scoped_query(
    col: firestore.CollectionReference, business_id: str
) -> firestore.Query:
    """Returns a query that auto-filters by business_id. Use everywhere."""
    return col.where(filter=firestore.FieldFilter("business_id", "==", business_id))
