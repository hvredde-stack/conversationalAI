"""Tool catalog — read access to the platform-curated `tools` collection.

The catalog holds tool *templates* (CatalogTool). Each business turns them on
and supplies its own config via `config_store`.
"""

from app.db.firestore import tools_col
from app.db.models import CatalogTool


def list_catalog() -> list[CatalogTool]:
    """Every tool published in the marketplace catalog."""
    return [CatalogTool(**snap.to_dict()) for snap in tools_col().stream()]


def get_catalog_tool(tool_id: str) -> CatalogTool | None:
    snap = tools_col().document(tool_id).get()
    if not snap.exists:
        return None
    return CatalogTool(**(snap.to_dict() or {}))


def save_catalog_tool(tool: CatalogTool) -> None:
    """Create or replace a catalog tool (platform-admin only — see api/platform)."""
    tools_col().document(tool.tool_id).set(tool.model_dump())


def delete_catalog_tool(tool_id: str) -> None:
    tools_col().document(tool_id).delete()
