# Frontend

React + Vite + TypeScript + Tailwind PWA. Talks to the backend over REST and WebSocket; authenticates users via Firebase Auth.

## Prerequisites

- Complete [`../SETUP.md`](../SETUP.md) — you'll need the Firebase web app config values.
- The backend running locally on http://localhost:8000 (see [`../backend/README.md`](../backend/README.md)).

## Install

Requires Node 20+.

```powershell
cd frontend
npm install
```

## Configure

```powershell
copy .env.example .env.local
# edit .env.local — paste the firebaseConfig values from SETUP.md step 6
```

## Run

```powershell
npm run dev
```

Open http://localhost:5173. The flow you should see:

1. **Sign up** — create an email/password account
2. **Create your business** — pick a name; you become the owner
3. **Chat** — type a message; Gemini streams a response

## Project layout

```
src/
├── main.tsx                React entry
├── App.tsx                 Top-level router (auth-aware)
├── index.css               Tailwind layers
├── contexts/
│   └── AuthContext.tsx     Firebase auth state + backend profile
├── lib/
│   ├── firebase.ts         Firebase client init
│   └── api.ts              authedFetch + WS token helper
└── pages/
    ├── Signup.tsx
    ├── Login.tsx
    ├── CreateBusiness.tsx  First-time owner onboarding
    └── Chat.tsx            WebSocket streaming chat UI
```

## Auth + routing logic

`App.tsx` decides which routes are mounted based on `useAuth()`:

- Not signed in → `/login`, `/signup`
- Signed in, no business yet (`needs_onboarding`) → `/onboarding`
- Signed in, has a business → `/chat`

When `CreateBusiness` succeeds, the backend sets `business_id` + `role=owner`
as Firebase custom claims. The frontend then calls `refreshProfile(true)`
which forces a token refresh so subsequent API calls see the new claims.

## What's coming next (Phase 1.5 / 2)

- Settings page (admins): upload knowledge base, manage team
- Image upload in chat (camera + file)
- Customer embed widget (separate build target)
- Mic input + TTS playback
