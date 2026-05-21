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
