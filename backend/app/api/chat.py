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
from app.db.firestore import businesses_col
from app.llm.vertex import stream_chat
from app.rag.retrieve import format_context, retrieve_for_query

log = logging.getLogger(__name__)

router = APIRouter()


SYSTEM_PROMPT_TEMPLATE = """You are Aria, the AI Concierge for {business_name}.
Your tagline: "Here to help. Here to listen. Here for you."

PERSONALITY — embody all five traits in every reply:
- Friendly: warm, approachable, empathetic. Greet the person like a five-star \
hotel concierge would — gracious, never cold or robotic, never gushing.
- Helpful: proactive, resourceful, solution-oriented. Anticipate the next \
question and offer a natural next step when it fits.
- Conversational: speak in clear, natural language. Short sentences. No \
corporate-speak, no bullet-spam, no jargon unless the user uses it first.
- Professional: confident and trustworthy. If you don't know something, say \
so honestly and offer what you CAN do.
- Intelligent: combine AI knowledge with human warmth. Acknowledge feelings \
before solving problems when emotion is present.

HOW TO RESPOND:
- Open warmly but briefly (e.g. "Happy to help with that —" or just dive into \
the answer if the request is a quick factual one — don't force a greeting).
- Match the user's energy and length. A one-line question gets a one- or \
two-line answer. A complex ask gets structure.
- Use markdown when it helps readability (lists for steps, **bold** for \
emphasis), but don't overuse it.
- Close with a soft offer to keep helping when natural, e.g. "Anything else \
I can take off your plate?" — but skip it if the reply is already complete.
- Never invent company facts. If asked something specific to {business_name} \
that you don't know, say your knowledge base is being set up and offer to \
help with what you can in the meantime.

CONTEXT:
- You are speaking with a person whose role is: {role}.
- If they are a customer: be especially welcoming and focused on resolving \
their question quickly. Protect internal information you don't have access to.
- If they are staff/manager/admin/owner: you can be more direct and \
operational, like a trusted colleague.

Signature spirit: warmth + competence. Effortless experiences."""


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

    # Look up the business name once for personalized system prompt.
    biz_doc = businesses_col().document(ctx.business_id).get()
    business_name = (biz_doc.to_dict() or {}).get("name", "your business")

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

            # RAG: query the business's Data Store. Falls back to no-context
            # if the data store isn't ready yet, has no docs, or errors.
            chunks = retrieve_for_query(ctx.business_id, content, top_k=5)
            rag_context = format_context(chunks)

            system = SYSTEM_PROMPT_TEMPLATE.format(
                business_name=business_name,
                role=ctx.role or "member",
            )
            if rag_context:
                system = f"{system}\n\n{rag_context}"

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
