"""The agent orchestration loop.

Runs the Gemini function-calling cycle: send the conversation + tool
declarations to the model, stream any text, execute any tool calls it
requests, feed the results back, and repeat until the model answers in plain
text (or `MAX_STEPS` is reached).
"""

import logging
from collections.abc import Awaitable, Callable

from google.genai import types

from app.agent.dispatcher import execute
from app.agent.registry import get_registry
from app.agent.tools import ToolContext, ToolSpec
from app.llm.vertex import stream_turn

log = logging.getLogger(__name__)

# Hard cap on model<->tool round trips per user message. On the final step the
# model is given no tools, so it is forced to answer in text — the loop always
# terminates with an answer.
MAX_STEPS = 5

OnText = Callable[[str], Awaitable[None]]
OnEvent = Callable[[dict], Awaitable[None]]


def _to_schema(js: dict) -> types.Schema:
    """Convert a JSON Schema fragment to a Gemini `types.Schema`."""
    type_name = str(js.get("type", "object")).upper()
    kwargs: dict = {"type": type_name}
    if js.get("description"):
        kwargs["description"] = js["description"]
    if js.get("enum"):
        kwargs["enum"] = js["enum"]
    if type_name == "OBJECT":
        kwargs["properties"] = {
            key: _to_schema(val) for key, val in (js.get("properties") or {}).items()
        }
        if js.get("required"):
            kwargs["required"] = list(js["required"])
    if type_name == "ARRAY" and js.get("items"):
        kwargs["items"] = _to_schema(js["items"])
    return types.Schema(**kwargs)


def _declarations(tools: list[ToolSpec]) -> list[types.FunctionDeclaration]:
    return [
        types.FunctionDeclaration(
            name=t.name,
            description=t.description,
            parameters=_to_schema(t.parameters),
        )
        for t in tools
    ]


def _history_to_contents(history: list[dict]) -> list[types.Content]:
    return [
        types.Content(
            role="user" if m["role"] == "user" else "model",
            parts=[types.Part.from_text(text=m["content"])],
        )
        for m in history
    ]


async def run_agent(
    *,
    history: list[dict],
    system_prompt: str,
    ctx: ToolContext,
    on_text: OnText,
    on_event: OnEvent,
) -> str:
    """Run one user turn to completion.

    `history` includes the current user message as its last item. Streams text
    via `on_text` and tool-status updates via `on_event`. Returns the full
    assistant answer (for the caller to append to its history).
    """
    tools = get_registry().resolve(ctx.tenant)
    by_name = {t.name: t for t in tools}
    gemini_tools = (
        [types.Tool(function_declarations=_declarations(tools))] if tools else None
    )

    contents = _history_to_contents(history)
    last_text = ""

    for step in range(MAX_STEPS):
        # On the final step, force a plain-text answer so the loop always
        # terminates — withholding tools alone doesn't stop the model, since
        # the conversation history still implies the functions exist.
        turn = await stream_turn(
            contents,
            system_prompt=system_prompt,
            tools=gemini_tools,
            force_text=step == MAX_STEPS - 1,
            on_text=on_text,
        )
        last_text = turn.text

        if not turn.function_calls:
            return last_text

        # Record the model's tool-calling turn, then run each requested tool.
        contents.append(turn.content)
        response_parts: list[types.Part] = []
        for call in turn.function_calls:
            args = dict(call.args or {})
            await on_event({"type": "tool", "name": call.name, "status": "running"})
            result = await execute(call.name, args, by_name, ctx)
            await on_event(
                {"type": "tool", "name": call.name, "status": "done", "ok": result.ok}
            )

            if result.ok:
                response = (
                    result.content
                    if isinstance(result.content, dict)
                    else {"result": result.content}
                )
            else:
                response = {"error": result.error or "The tool failed."}
            response_parts.append(
                types.Part.from_function_response(name=call.name, response=response)
            )

        contents.append(types.Content(role="user", parts=response_parts))

    log.warning("run_agent hit MAX_STEPS without a tool-free answer")
    return last_text
