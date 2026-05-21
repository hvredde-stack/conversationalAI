"""Per-business tool configuration.

Each business decides which catalog tools to enable and supplies its own
config (which calendar, which API base URL, etc.) — this is what makes the
marketplace multi-tenant. Stored at businesses/{bid}/tool_configs/{tool_id}.
"""

from app.db.firestore import tool_configs_col
from app.db.models import BusinessToolConfig


def list_tool_configs(business_id: str) -> list[BusinessToolConfig]:
    return [
        BusinessToolConfig(**snap.to_dict())
        for snap in tool_configs_col(business_id).stream()
    ]


def get_tool_config(business_id: str, tool_id: str) -> BusinessToolConfig | None:
    snap = tool_configs_col(business_id).document(tool_id).get()
    if not snap.exists:
        return None
    return BusinessToolConfig(**(snap.to_dict() or {}))


def save_tool_config(cfg: BusinessToolConfig) -> None:
    tool_configs_col(cfg.business_id).document(cfg.tool_id).set(cfg.model_dump())
