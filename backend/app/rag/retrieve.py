"""Query the business's Data Store and format snippets for LLM context."""

import logging
from dataclasses import dataclass

from google.cloud import discoveryengine_v1 as discoveryengine

from app.config import get_settings
from app.rag.client import search_client, serving_config_name

log = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    title: str
    snippet: str
    uri: str | None


def retrieve_for_query(business_id: str, query: str, top_k: int = 5) -> list[RetrievedChunk]:
    """Search the business's Data Store and return top-k snippets.

    Returns [] if the Data Store doesn't exist yet, has no documents, or any
    error occurs. Callers should fall back gracefully — never block the chat.
    """
    settings = get_settings()
    serving_config = serving_config_name(settings.gcp_project_id, business_id)

    content_spec = discoveryengine.SearchRequest.ContentSearchSpec(
        snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
            return_snippet=True,
        ),
        # Cap how much text Discovery Engine includes — keeps token cost low.
        extractive_content_spec=discoveryengine.SearchRequest.ContentSearchSpec.ExtractiveContentSpec(
            max_extractive_answer_count=1,
            max_extractive_segment_count=2,
        ),
    )

    request = discoveryengine.SearchRequest(
        serving_config=serving_config,
        query=query,
        page_size=top_k,
        content_search_spec=content_spec,
        query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
            condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO,
        ),
        spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
            mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO,
        ),
    )

    try:
        response = search_client().search(request=request)
    except Exception as e:
        log.info("Search failed for business %s (likely not ready): %s", business_id, e)
        return []

    chunks: list[RetrievedChunk] = []
    for result in response.results:
        # `derived_struct_data` is a Struct (proto); convert to dict via .get
        doc = result.document
        derived = dict(doc.derived_struct_data) if doc.derived_struct_data else {}
        link = derived.get("link") or None
        title = derived.get("title") or doc.name.rsplit("/", 1)[-1]

        # Snippets returned per result; pick the first non-empty
        snippet_text = ""
        for s in derived.get("snippets") or []:
            if isinstance(s, dict) and s.get("snippet"):
                snippet_text = s["snippet"]
                break

        # Extractive answers/segments often have richer text than snippets
        for ea in derived.get("extractive_answers") or []:
            if isinstance(ea, dict) and ea.get("content"):
                snippet_text = ea["content"]
                break
        if not snippet_text:
            for seg in derived.get("extractive_segments") or []:
                if isinstance(seg, dict) and seg.get("content"):
                    snippet_text = seg["content"]
                    break

        if snippet_text:
            chunks.append(RetrievedChunk(title=title, snippet=snippet_text, uri=link))
        if len(chunks) >= top_k:
            break

    return chunks


def format_context(chunks: list[RetrievedChunk]) -> str:
    """Format retrieved chunks for injection into Aria's system prompt."""
    if not chunks:
        return ""
    lines = ["Relevant information from the business's knowledge base:", ""]
    for i, c in enumerate(chunks, 1):
        lines.append(f"[{i}] Source: {c.title}")
        lines.append(c.snippet.strip())
        lines.append("")
    lines.append(
        "When relevant, ground your answer in the snippets above and cite "
        "them inline like [1] or [2]. If the snippets don't cover the "
        "question, answer from general knowledge and note that the company's "
        "knowledge base didn't have specifics."
    )
    return "\n".join(lines)
