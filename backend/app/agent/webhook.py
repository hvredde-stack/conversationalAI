"""Webhook executor — calls an external HTTP endpoint as a tool.

This is the generic executor behind every marketplace webhook tool: it reads
external data (GET) or takes an action (POST/PUT/...), with the business's own
URL and credentials. SSRF-guarded so a tool can never be pointed at internal
infrastructure.
"""

import asyncio
import ipaddress
import logging
import socket
from urllib.parse import urlparse

import httpx

from app.agent.secrets import read_secret
from app.agent.tools import ToolContext, ToolResult
from app.db.models import BusinessToolConfig, CatalogTool

log = logging.getLogger(__name__)

_MAX_RESPONSE_CHARS = 8000


def assert_safe_url(url: str) -> None:
    """Reject non-HTTP(S) schemes and any host that resolves to a private,
    loopback, link-local, reserved, or multicast address (SSRF guard).

    Note: this checks DNS at validation time; a determined rebinding attack
    could still shift the IP. Acceptable for a platform-curated catalog —
    revisit with IP-pinning if business self-registration is added.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"unsupported scheme '{parsed.scheme}'")
    host = parsed.hostname
    if not host:
        raise ValueError("URL has no host")
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise ValueError(f"cannot resolve host '{host}'") from e
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise ValueError(f"host resolves to non-public address {ip}")


def _render(template: str, config: dict) -> str:
    """Substitute {config.<key>} placeholders with the business's config values."""
    rendered = template
    for key, value in (config or {}).items():
        rendered = rendered.replace("{config." + key + "}", str(value))
    return rendered


async def execute_webhook(
    catalog: CatalogTool,
    cfg: BusinessToolConfig,
    args: dict,
    ctx: ToolContext,
) -> ToolResult:
    """Run a webhook tool: build the request from the catalog definition + the
    business's config, call it, and return the response to the model."""
    webhook = catalog.webhook
    if webhook is None:
        return ToolResult(ok=False, error="Tool has no webhook definition.")

    url = _render(webhook.url_template, cfg.config)
    try:
        assert_safe_url(url)
    except ValueError as e:
        log.warning("Blocked webhook URL for tool %s: %s", catalog.tool_id, e)
        return ToolResult(ok=False, error=f"Blocked webhook URL: {e}")

    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    auth = webhook.auth
    if auth.type in ("bearer", "header"):
        if not auth.secret_key:
            return ToolResult(ok=False, error="Tool auth is misconfigured.")
        ref = cfg.secret_refs.get(auth.secret_key)
        if not ref:
            return ToolResult(ok=False, error="This tool is missing its credential.")
        try:
            secret = await asyncio.to_thread(read_secret, ref)
        except Exception:
            log.exception("Failed to read secret for tool %s", catalog.tool_id)
            return ToolResult(ok=False, error="Could not load the tool credential.")
        if auth.type == "bearer":
            headers["Authorization"] = f"Bearer {secret}"
        else:
            headers[auth.header_name or "X-API-Key"] = secret

    try:
        # follow_redirects stays off — a redirect could bypass the SSRF check.
        async with httpx.AsyncClient(
            timeout=webhook.timeout_s, follow_redirects=False
        ) as client:
            if webhook.method == "GET":
                resp = await client.get(url, params=args, headers=headers)
            else:
                resp = await client.request(
                    webhook.method, url, json=args, headers=headers
                )
    except httpx.HTTPError as e:
        return ToolResult(ok=False, error=f"Request to the external service failed: {e}")

    if resp.status_code >= 400:
        return ToolResult(
            ok=False,
            error=f"External service returned HTTP {resp.status_code}: "
            f"{resp.text[:300]}",
        )

    try:
        body = resp.json()
    except ValueError:
        body = {"text": resp.text[:_MAX_RESPONSE_CHARS]}
    return ToolResult(
        ok=True,
        content=body if isinstance(body, dict) else {"result": body},
    )
