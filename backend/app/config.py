from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gcp_project_id: str
    gcp_location: str = "us-central1"
    firebase_project_id: str

    gcs_uploads_bucket: str

    # gemini-3.5-flash is served only via the "global" Vertex endpoint, so the
    # Vertex client location is "global" (distinct from the Cloud Run region).
    vertex_location: str = "global"
    gemini_model: str = "gemini-3.5-flash"
    gemini_fast_model: str = "gemini-3.5-flash"

    app_env: str = "dev"
    log_level: str = "INFO"
    frontend_origin: str = "http://localhost:5173"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
