# Backend

FastAPI service for the Conversational AI platform.

## Prerequisites

Complete [`../SETUP.md`](../SETUP.md) first. You should have:
- A GCP project with APIs enabled
- A Firebase project linked to it
- A service account JSON key at `backend/service-account.json`

## Install

Requires Python 3.11+.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

## Configure

```powershell
copy .env.example .env
# edit .env — set GCP_PROJECT_ID, FIREBASE_PROJECT_ID, GCS_UPLOADS_BUCKET to your values
```

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

Health check: http://localhost:8000/health

## What's implemented (Phase 1)

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /health` | None | Liveness probe |
| `GET /api/auth/me` | Firebase token | Get caller's profile; returns `needs_onboarding` for first sign-in |
| `POST /api/businesses` | Firebase token (no business yet) | Create a business; caller becomes owner |
| `WS /api/chat?token=...` | Firebase token via query | Stream chat with Gemini 2.5 Pro |

## What's coming next (Phase 1.5)

- `POST /api/invites` — invite an employee
- `POST /api/invites/{token}/accept` — accept invite, join business with role
- `POST /api/documents` — upload doc to Cloud Storage + ingest into Vertex AI Search Data Store
- Replace direct Gemini call in chat with Vertex AI Agent Builder agent invocation

## Project layout

```
app/
├── main.py              FastAPI entry, CORS, router mounting
├── config.py            Pydantic settings from .env
├── auth/
│   ├── firebase.py      Admin SDK init, token verify, set_custom_claims
│   ├── context.py       TenantContext + role hierarchy
│   └── middleware.py    FastAPI dependency: current_user
├── db/
│   ├── firestore.py     Firestore client + tenant-scoped collection helpers
│   └── models.py        Pydantic models for stored docs + API payloads
├── llm/
│   └── vertex.py        Gemini streaming wrapper (uses Vertex SDK)
├── api/
│   ├── auth.py          /api/auth/me
│   ├── businesses.py    /api/businesses
│   └── chat.py          /api/chat WebSocket
├── agents/              (empty — Phase 1.5 Agent Builder integration)
└── rag/                 (empty — Phase 1.5 Vertex AI Search ingestion)
```

## Auth model

Every authenticated request carries a Firebase ID token. The `current_user`
dependency verifies it, decodes the claims, and builds a `TenantContext` with
`{uid, email, business_id, role}`. **All four fields come from the verified
token only** — never from the request body or query string. This is the
backbone of tenant isolation.

`business_id` and `role` live in **Firebase custom claims**, set via the Admin
SDK after business creation / invite acceptance. The frontend must call
`getIdToken(true)` to force-refresh after these changes so the new claims
appear in the token.

## Deploying to Cloud Run (later)

```powershell
# Build & deploy in one shot using Cloud Build:
gcloud run deploy convai-backend `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --service-account convai-backend@$env:GCP_PROJECT_ID.iam.gserviceaccount.com
```

On Cloud Run, the attached service account replaces the local JSON key — no
secrets in the deployment.
