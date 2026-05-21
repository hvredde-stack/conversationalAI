"""Built-in tool: query_business_knowledge — RAG search over the tenant's
Vertex AI Search Data Store.

This replaces the old always-on context injection in chat.py: the model now
decides when to search, and can search again with a refined query.
"""

import asyncio

from app.agent.tools import ToolContext, ToolResult, ToolSpec
from app.rag.retrieve import retrieve_for_query

_TOP_K = 5


async def _execute(args: dict, ctx: ToolContext) -> ToolResult:
    query = str(args.get("query", "")).strip()
    if not query:
        return ToolResult(ok=False, error="The 'query' argument is required.")

    # business_id comes from the verified token only — never from `args`.
    business_id = ctx.tenant.business_id
    if not business_id:
        return ToolResult(ok=False, error="No business is associated with this user.")

    # retrieve_for_query uses the synchronous Discovery Engine client; run it
    # off the event loop so streaming for other requests isn't blocked.
    chunks = await asyncio.to_thread(retrieve_for_query, business_id, query, _TOP_K)

    if not chunks:
        return ToolResult(
            ok=True,
            content={
                "results": [],
                "note": (
                    "No matching documents in the knowledge base. It likely "
                    "doesn't cover this — tell the user rather than searching "
                    "again with reworded queries."
                ),
            },
        )

    return ToolResult(
        ok=True,
        content={
            "results": [
                {"source": c.title, "text": c.snippet, "uri": c.uri} for c in chunks
            ]
        },
    )


KNOWLEDGE_TOOL = ToolSpec(
    name="query_business_knowledge",
    description=(
        "Search the business's knowledge base for specifics about their "
        "services, pricing, packages, policies, hours, availability, or "
        "uploaded documents. Use this whenever the user asks something "
        "specific to this business rather than general knowledge. You may "
        "call it more than once with refined queries."
    ),
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query — what to look up.",
            }
        },
        "required": ["query"],
    },
    executor=_execute,
    min_role="customer",
)
