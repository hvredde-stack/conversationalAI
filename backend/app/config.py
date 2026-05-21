from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gcp_project_id: str
    gcp_location: str = "us-central1"
    firebase_project_id: str

    gcs_uploads_bucket: str

    vertex_location: str = "us-central1"
    gemini_model: str = "gemini-2.5-pro"
    # gemini-3.5-flash is served only via the "global" Vertex endpoint, not
    # us-central1. When the router path is built, the fast model must be called
    # with a genai.Client created at location="global".
    gemini_fast_model: str = "gemini-3.5-flash"

    app_env: str = "dev"
    log_level: str = "INFO"
    frontend_origin: str = "http://localhost:5173"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
