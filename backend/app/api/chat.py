"""WebSocket chat endpoint.

Protocol:
  Client opens ws to /api/chat?token=<firebase_id_token>
  Server replies with {"type": "ready"} or {"type": "error", ...}
  Client sends:  {"type": "user_message", "content": "..."}
  Server streams: {"type": "token", "content": "..."} (many)
                  {"type": "done"}
"""

import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.auth.middleware import verify_token_string
from app.llm.vertex import stream_chat

log = logging.getLogger(__name__)

router = APIRouter()


SYSTEM_PROMPT_TEMPLATE = (
    "You are the conversational AI assistant for {business_name}. "
    "The user you're talking to has the role '{role}'. "
    "Be helpful, accurate, and concise. "
    "When asked about company-specific information, say you'll have a knowledge "
    "base soon — RAG grounding ships in the next update."
)


@router.websocket("/api/chat")
async def chat_ws(ws: WebSocket, token: str = Query(...)) -> None:
    await ws.accept()

    # Auth: verify the Firebase token from the query string.
    try:
        ctx = await verify_token_string(token)
    except PermissionError as e:
        await ws.send_json({"type": "error", "code": "auth", "message": str(e)})
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if not ctx.business_id:
        await ws.send_json(
            {"type": "error", "code": "no_business", "message": "Create a business first."}
        )
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.send_json({"type": "ready"})

    history: list[dict] = []

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "code": "bad_json"})
                continue

            if msg.get("type") != "user_message":
                continue

            content = (msg.get("content") or "").strip()
            if not content:
                continue

            history.append({"role": "user", "content": content})

            # TODO Phase 1.5: replace direct Gemini call with Agent Builder
            # invocation that passes session params {business_id, role, ...}
            # and calls tools (query_business_knowledge, analyze_image, ...).
            system = SYSTEM_PROMPT_TEMPLATE.format(
                business_name="your business",  # TODO: look up from Firestore
                role=ctx.role or "member",
            )

            assistant_buffer = ""
            try:
                async for token_text in stream_chat(history, system_prompt=system):
                    assistant_buffer += token_text
                    await ws.send_json({"type": "token", "content": token_text})
            except Exception:
                log.exception("LLM streaming failed")
                await ws.send_json({"type": "error", "code": "llm_failure"})
                continue

            history.append({"role": "assistant", "content": assistant_buffer})
            await ws.send_json({"type": "done"})

    except WebSocketDisconnect:
        return
