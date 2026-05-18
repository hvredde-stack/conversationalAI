"""FastAPI dependency that turns a request's Authorization header into a TenantContext."""

from fastapi import Header, HTTPException, status
from firebase_admin import auth as fb_auth

from app.auth.context import TenantContext, context_from_claims
from app.auth.firebase import verify_id_token


async def current_user(authorization: str | None = Header(default=None)) -> TenantContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = verify_id_token(token)
    except fb_auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired.")
    return context_from_claims(claims)


async def verify_token_string(token: str) -> TenantContext:
    """For WebSocket auth — verify a raw token string and return a TenantContext."""
    try:
        claims = verify_id_token(token)
    except (fb_auth.InvalidIdTokenError, fb_auth.ExpiredIdTokenError) as e:
        raise PermissionError(str(e)) from e
    return context_from_claims(claims)
