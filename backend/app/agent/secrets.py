"""Secret Manager helper for webhook tool credentials.

Webhook tools often need an API key. The plaintext value never touches
Firestore — it is written to Secret Manager and only the resource name of
the resulting version is stored in the business's tool config.
"""

import re

from google.api_core.exceptions import AlreadyExists
from google.cloud import secretmanager

from app.config import get_settings

_SAFE = re.compile(r"[^a-zA-Z0-9_-]")


def _client() -> secretmanager.SecretManagerServiceClient:
    return secretmanager.SecretManagerServiceClient()


def _secret_id(business_id: str, tool_id: str, key: str) -> str:
    raw = f"convai-tool-{business_id}-{tool_id}-{key}"
    return _SAFE.sub("-", raw)[:255]


def write_secret(business_id: str, tool_id: str, key: str, value: str) -> str:
    """Store a credential; return the Secret Manager resource name of the new
    version. Safe to call repeatedly — adds a new version each time."""
    project = get_settings().gcp_project_id
    client = _client()
    parent = f"projects/{project}"
    secret_id = _secret_id(business_id, tool_id, key)

    try:
        client.create_secret(
            parent=parent,
            secret_id=secret_id,
            secret={"replication": {"automatic": {}}},
        )
    except AlreadyExists:
        pass  # secret already exists — just add a new version below

    version = client.add_secret_version(
        parent=f"{parent}/secrets/{secret_id}",
        payload={"data": value.encode("utf-8")},
    )
    return version.name  # projects/.../secrets/.../versions/N


def read_secret(resource_name: str) -> str:
    """Resolve a stored credential by its Secret Manager resource name."""
    response = _client().access_secret_version(name=resource_name)
    return response.payload.data.decode("utf-8")
