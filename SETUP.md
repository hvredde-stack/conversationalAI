# Setup — Quickstart

End-to-end setup in ~5 minutes after the prerequisites. One script does GCP + Firebase + GitHub.

## What's automated

`scripts/bootstrap.ps1` will:
- Create the GCP project and link billing
- Enable all required APIs (Cloud Run, Firestore, Storage, Vertex AI, Identity Toolkit, Firebase, Discovery Engine, IAM, STS, Cloud Build, Artifact Registry)
- Create Firestore (native) and a Cloud Storage bucket
- Create a service account, grant runtime + deploy roles, and write a local dev key
- Add Firebase to the project, register a web app, enable Email/Password auth
- Write `backend/.env` and `frontend/.env.local` with all the right values
- Set up Workload Identity Federation so GitHub Actions can deploy without storing a service-account key
- Create the GitHub repo (`gh repo create`), push the initial code, and set CI secrets/vars

## What you do manually (one-time)

1. **Install CLIs** — `gcloud`, `firebase`, `gh`, `git`, `node`, `python`
2. **Authenticate**:
   ```powershell
   gcloud auth login
   gcloud auth application-default login
   firebase login
   gh auth login
   ```
3. **Get a billing account ID** — create one at https://console.cloud.google.com/billing if you don't have one, then list with:
   ```powershell
   gcloud billing accounts list
   ```
   Copy the ACCOUNT_ID (format: `XXXXXX-XXXXXX-XXXXXX`).

## Run the bootstrap

```powershell
cd "c:\Conversational AI"
.\scripts\bootstrap.ps1 `
    -ProjectId convai-yourname-001 `
    -BillingAccount XXXXXX-XXXXXX-XXXXXX `
    -GithubRepo yourname/convai
```

Pick `ProjectId` carefully — must be globally unique, lowercase, 6–30 chars, can't be changed later.

The script takes 2–3 minutes. It's reasonably idempotent: most steps tolerate "already exists" by continuing.

## After bootstrap finishes

The script prints a summary with the project number, service account, Firebase config, and GitHub repo URL. From there:

### Run locally
```powershell
# Backend (one terminal)
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Frontend (another terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### Deploy
- **Via CI (recommended):** push to `main`. The workflows in `.github/workflows/` deploy backend → Cloud Run and frontend → Firebase Hosting.
- **Manually from your machine:**
  ```powershell
  .\scripts\deploy-backend.ps1
  # then take the Cloud Run URL it prints, update VITE_BACKEND_URL/VITE_BACKEND_WS_URL,
  # and:
  .\scripts\deploy-frontend.ps1
  ```

### After the first backend deploy

The frontend needs to know the Cloud Run URL. The bootstrap creates empty GitHub variables `VITE_BACKEND_URL` and `VITE_BACKEND_WS_URL`. Fill them in:

```powershell
$url = gcloud run services describe convai-backend --region us-central1 --format="value(status.url)"
gh variable set VITE_BACKEND_URL --body "$url" --repo yourname/convai
gh variable set VITE_BACKEND_WS_URL --body ($url -replace '^https://', 'wss://') --repo yourname/convai
```

Then re-trigger the frontend workflow (`gh workflow run frontend-deploy.yml --repo yourname/convai`).

## Tearing it down

```powershell
.\scripts\teardown.ps1 -ProjectId convai-yourname-001 -GithubRepo yourname/convai -PurgeLocal
```

GCP gives you a 30-day grace period to undelete: `gcloud projects undelete <id>`.

## Cost expectations during dev

| Service | Free tier covers dev? | Paid by which credit |
|---|---|---|
| Firestore | Yes (1 GB, 50k reads/day) | — |
| Cloud Run | Yes (2M req/mo) | — |
| Cloud Storage | Yes (5 GB) | — |
| Firebase Auth | Yes (50k MAU) | — |
| Firebase Hosting | Yes (10 GB transfer/mo) | — |
| Vertex AI Gemini | No — pay per token | $1,369 GenAI credit |
| Vertex AI Search Data Stores | No — pay per query/index | $1,369 GenAI credit |

You should see $0 on the bill during dev as long as Vertex usage stays inside the GenAI credit.

## Troubleshooting

**`firebase` CLI: "permission denied" when creating the web app**
The Firebase project may not be fully provisioned yet. Wait ~30 seconds and re-run `bootstrap.ps1` — it's safe to re-run.

**`gcloud iam workload-identity-pools create` fails with "already exists"**
Safe to ignore — the script proceeds. The script's `Try-Run` wrapper logs it as `skip:`.

**`gh repo create` fails with "name already exists"**
You already created the repo. Either pick a different `-GithubRepo` arg, delete the existing repo (`gh repo delete owner/name`), or re-run with `-SkipRepoCreate` to leave the repo step alone.

**Email/Password auth not enabled**
The script tries via Identity Toolkit REST API. If it warns, open the [Firebase Console → Authentication → Sign-in method](https://console.firebase.google.com/) and toggle Email/Password manually. One click.
