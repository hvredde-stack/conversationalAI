"""Pydantic models for Firestore documents and API payloads."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Role = Literal["owner", "admin", "manager", "staff", "customer"]
DocumentStatus = Literal["uploaded", "processing", "ready", "failed"]


class Business(BaseModel):
    id: str
    name: str
    owner_uid: str
    created_at: datetime
    data_store_id: str | None = None
    data_store_ready: bool = False
    widget_api_key: str | None = None


class UserDoc(BaseModel):
    uid: str
    business_id: str
    role: Role
    email: EmailStr
    display_name: str | None = None
    created_at: datetime


class Invite(BaseModel):
    id: str
    business_id: str
    email: EmailStr
    role: Role
    token: str
    expires_at: datetime
    status: Literal["pending", "accepted", "expired", "revoked"] = "pending"
    created_at: datetime


class Document(BaseModel):
    id: str
    business_id: str
    uploaded_by_uid: str
    filename: str
    content_type: str
    size_bytes: int
    gcs_path: str
    status: DocumentStatus = "uploaded"
    error: str | None = None
    created_at: datetime


# --- API request/response payloads -------------------------------------------

class CreateBusinessRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CreateBusinessResponse(BaseModel):
    business: Business
    user: UserDoc


class MeResponse(BaseModel):
    uid: str
    email: str | None
    business_id: str | None
    role: Role | None
    needs_onboarding: bool
    is_platform_admin: bool = False


class DocumentListResponse(BaseModel):
    documents: list[Document]


# --- Tool marketplace --------------------------------------------------------

ToolExecutorType = Literal["builtin", "webhook"]
HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]
ToolAuthType = Literal["none", "bearer", "header"]


class WebhookAuth(BaseModel):
    type: ToolAuthType = "none"
    header_name: str | None = None  # for type="header"
    secret_key: str | None = None  # key into a business config's secret_refs


class WebhookDef(BaseModel):
    method: HttpMethod = "POST"
    url_template: str  # may contain {config.<key>} placeholders
    auth: WebhookAuth = Field(default_factory=WebhookAuth)
    timeout_s: int = 20


class CatalogTool(BaseModel):
    """A platform-published tool template — Firestore: tools/{tool_id}."""

    tool_id: str
    name: str  # function name exposed to Gemini — must be an identifier
    display_name: str
    description: str
    parameters: dict = Field(default_factory=dict)  # JSON Schema for model args
    executor_type: ToolExecutorType = "webhook"
    webhook: WebhookDef | None = None
    # JSON Schema for the values each business must supply (e.g. base_url).
    config_schema: dict = Field(default_factory=dict)
    min_role: Role = "customer"
    requires_confirmation: bool = False
    created_at: datetime
    created_by_uid: str


class BusinessToolConfig(BaseModel):
    """A business's per-tool settings — businesses/{bid}/tool_configs/{tool_id}."""

    tool_id: str
    business_id: str
    enabled: bool = False
    config: dict = Field(default_factory=dict)  # values for the tool's config_schema
    secret_refs: dict[str, str] = Field(default_factory=dict)  # secret_key -> SM resource
    updated_at: datetime
    updated_by_uid: str
