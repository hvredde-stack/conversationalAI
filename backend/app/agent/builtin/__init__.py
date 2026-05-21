"""Built-in tools — implemented as Python functions in this package."""

from app.agent.builtin.knowledge import KNOWLEDGE_TOOL
from app.agent.tools import ToolSpec

# The set of tools compiled into the backend. Phase 2 adds Firestore-defined
# webhook / MCP tools alongside these.
BUILTIN_TOOLS: list[ToolSpec] = [KNOWLEDGE_TOOL]
