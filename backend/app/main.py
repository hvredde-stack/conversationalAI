"""FastAPI entry point. Boot Firebase, mount routers, configure CORS."""

import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth as auth_api
from app.api import businesses as business_api
from app.api import chat as chat_api
from app.api import documents as documents_api
from app.api import platform as platform_api
from app.api import tools as tools_api
from app.auth.firebase import init_firebase
from app.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)

    app = FastAPI(title="Conversational AI Backend", version="0.1.0")

    init_firebase()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_api.router)
    app.include_router(business_api.router)
    app.include_router(chat_api.router)
    app.include_router(documents_api.router)
    app.include_router(platform_api.router)
    app.include_router(tools_api.router)

    @app.exception_handler(PermissionError)
    async def _permission_denied(_: Request, exc: PermissionError) -> JSONResponse:
        # TenantContext.require_business / require_role raise PermissionError.
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": str(exc)},
        )

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
