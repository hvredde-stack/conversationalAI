"""Vertex AI Gemini client — streaming chat completion.

All LLM calls go through here so the GenAI credit pays for everything.

Phase 1: direct Gemini calls. Phase 1.5 will swap this for Vertex AI Agent
Builder once the agent + per-business Data Stores are provisioned.
"""

from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass

from google import genai
from google.genai import types

from app.config import get_settings

# Module-level singleton so the underlying httpx client isn't recreated per
# call (which was causing "Cannot send a request, as the client has been
# closed" mid-stream).
_client_instance: genai.Client | None = None


def _client() -> genai.Client:
    global _client_instance
    if _client_instance is None:
        settings = get_settings()
        _client_instance = genai.Client(
            vertexai=True,
            project=settings.gcp_project_id,
            location=settings.vertex_location,
        )
    return _client_instance


async def stream_chat(
    messages: list[dict],
    *,
    system_prompt: str | None = None,
    model: str | None = None,
) -> AsyncIterator[str]:
    """Stream tokens from Gemini via Vertex AI (async).

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

    # client.aio.* is the async API surface — keeps the httpx client alive for
    # the lifetime of the stream and plays nicely with FastAPI's event loop.
    stream = await _client().aio.models.generate_content_stream(
        model=model_name,
        contents=contents,
        config=config,
    )

    async for chunk in stream:
        if chunk.text:
            yield chunk.text


@dataclass
class TurnResult:
    """The result of one model call within the agent loop."""

    text: str  # all text the model produced this turn
    function_calls: list[types.FunctionCall]  # tools the model asked to run
    content: types.Content  # the model turn, to append back to the conversation


async def stream_turn(
    contents: list[types.Content],
    *,
    system_prompt: str,
    tools: list[types.Tool] | None = None,
    force_text: bool = False,
    on_text: Callable[[str], Awaitable[None]] | None = None,
    model: str | None = None,
) -> TurnResult:
    """Run one Gemini call for the agent loop.

    Streams text chunks to `on_text` as they arrive and collects any function
    calls the model requests. With `force_text=True` the model is restricted
    to a plain-text answer (no tool calls) — used on the loop's final step so
    it always terminates with an answer.
    """
    settings = get_settings()
    model_name = model or settings.gemini_model

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.7,
        tools=tools,
        tool_config=(
            types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="NONE")
            )
            if force_text
            else None
        ),
    )

    stream = await _client().aio.models.generate_content_stream(
        model=model_name,
        contents=contents,
        config=config,
    )

    text = ""
    parts: list[types.Part] = []
    function_calls: list[types.FunctionCall] = []
    async for chunk in stream:
        for candidate in chunk.candidates or []:
            content = candidate.content
            if not content or not content.parts:
                continue
            for part in content.parts:
                # Keep the original Part as-is — function-call parts carry a
                # thought_signature that Gemini 3 requires when the model
                # turn is sent back into the conversation.
                parts.append(part)
                if part.text:
                    text += part.text
                    if on_text:
                        await on_text(part.text)
                if part.function_call:
                    function_calls.append(part.function_call)

    return TurnResult(
        text=text,
        function_calls=function_calls,
        content=types.Content(role="model", parts=parts),
    )
