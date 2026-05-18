"""Vertex AI Gemini client — streaming chat completion.

All LLM calls go through here so the GenAI credit pays for everything.

Phase 1: direct Gemini calls. Phase 1.5 will swap this for Vertex AI Agent
Builder once the agent + per-business Data Stores are provisioned.
"""

from collections.abc import AsyncIterator

from google import genai
from google.genai import types

from app.config import get_settings


def _client() -> genai.Client:
    settings = get_settings()
    return genai.Client(
        vertexai=True,
        project=settings.gcp_project_id,
        location=settings.vertex_location,
    )


async def stream_chat(
    messages: list[dict],
    *,
    system_prompt: str | None = None,
    model: str | None = None,
) -> AsyncIterator[str]:
    """Stream tokens from Gemini.

    messages: [{"role": "user" | "assistant", "content": "..."}, ...]
    """
    settings = get_settings()
    model_name = model or settings.gemini_model

    contents = [
        types.Content(
            role="user" if m["role"] == "user" else "model",
            parts=[types.Part.from_text(text=m["content"])],
        )
        for m in messages
    ]

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.7,
    )

    stream = _client().models.generate_content_stream(
        model=model_name,
        contents=contents,
        config=config,
    )

    for chunk in stream:
        if chunk.text:
            yield chunk.text
