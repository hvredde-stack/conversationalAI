# Conversational AI Platform

A B2B2C conversational AI platform on GCP. Businesses sign up, invite employees, upload their knowledge base, and serve both internal staff and external customers through a Gemini-powered assistant with per-business data isolation.

## Architecture at a glance

```
React PWA  ──(Firebase ID token)──▶  FastAPI on Cloud Run
                                          │
                              ┌───────────┼─────────────┐
                              ▼           ▼             ▼
                         Firestore   Cloud Storage   Vertex AI
                         (tenants,   (uploads)       (Agent Builder
                          users,                      + Search
                          chats)                      + Gemini)
```

**Tenant model (B2B2C):**
- Platform → many businesses
- Each business has roles: `owner`, `admin`, `manager`, `staff`, `customer`
- Tenant isolation is enforced at every layer: JWT claims, Firestore `business_id` filtering, per-business Vertex AI Search Data Stores.

## Project layout

```
backend/   FastAPI service, deploys to Cloud Run
frontend/  React + Vite PWA, deploys to Firebase Hosting
SETUP.md   First-time GCP/Firebase project setup walkthrough
```

## Getting started

1. **Set up GCP & Firebase** — follow [`SETUP.md`](SETUP.md). This is a one-time task that creates the project, enables APIs, and produces the credentials the backend needs.
2. **Run the backend** — see [`backend/README.md`](backend/README.md).
3. **Run the frontend** — see [`frontend/README.md`](frontend/README.md).

## Phase plan

- **Phase 1 (current scaffold)**: signup, business creation, role-based auth, basic chat with Gemini.
- **Phase 1.5**: document upload + Vertex AI Search Data Store ingestion + RAG-grounded answers; team invites.
- **Phase 2**: image upload in chat (vision), voice (mic + TTS), customer embed widget.
- **Phase 3**: tool calling (PDF quotes, send email, availability), MCP integrations.
- **Future**: custom Android device support, external camera/mic.

## Cost model

Architecture is designed around two GCP credits:
- **$1,369 GenAI credit** (Vertex AI scope) → pays for all LLM, embedding, and Search Data Store usage.
- **Free tiers everywhere else** → Firestore, Cloud Run, Cloud Storage, Firebase Auth all stay within free quotas during dev.

If chat volume scales past free tiers, Cloud Run requests are the most likely first paid line item.
