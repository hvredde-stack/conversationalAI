"""WebSocket chat endpoint.

Protocol:
  Client opens ws to /api/chat?token=<firebase_id_token>
  Server replies with {"type": "ready"} or {"type": "error", ...}
  Client sends:  {"type": "user_message", "content": "..."}
  Server streams: {"type": "token", "content": "..."} (many)
                  {"type": "tool", "name": "...", "status": "running"|"done"}
                  {"type": "done"}
"""

import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.agent.orchestrator import run_agent
from app.agent.tools import ToolContext
from app.auth.middleware import verify_token_string
from app.db.firestore import businesses_col

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
- Never invent company facts. For anything specific to {business_name}, use \
the query_business_knowledge tool to look it up — don't guess.

TOOLS:
- query_business_knowledge: searches {business_name}'s knowledge base. Use it \
whenever the user asks about the business's services, pricing, packages, \
policies, hours, availability, or documents. Search before answering such a \
question, and feel free to search again with a refined query. If it returns \
nothing, tell the user the knowledge base doesn't cover that yet.

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

            system = SYSTEM_PROMPT_TEMPLATE.format(
                business_name=business_name,
                role=ctx.role or "member",
            )
            tool_ctx = ToolContext(tenant=ctx, business_name=business_name)

            async def on_text(text: str) -> None:
                await ws.send_json({"type": "token", "content": text})

            async def on_event(event: dict) -> None:
                await ws.send_json(event)

            try:
                answer = await run_agent(
                    history=history,
                    system_prompt=system,
                    ctx=tool_ctx,
                    on_text=on_text,
                    on_event=on_event,
                )
            except Exception:
                log.exception("Agent run failed")
                await ws.send_json({"type": "error", "code": "llm_failure"})
                continue

            history.append({"role": "assistant", "content": answer})
            await ws.send_json({"type": "done"})

    except WebSocketDisconnect:
        return
