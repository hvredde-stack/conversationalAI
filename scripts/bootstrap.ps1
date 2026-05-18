<#
.SYNOPSIS
  One-shot setup: GCP project, Firebase, GitHub repo, Workload Identity, local env.

.DESCRIPTION
  Creates everything needed to run and deploy this app. Idempotent-ish — most
  steps tolerate already-existing resources by continuing past errors and
  reporting at the end.

  After this runs you will have:
    - A GCP project with required APIs enabled, Firestore (Native), and a
      Cloud Storage bucket for uploads.
    - A runtime service account with local dev key at backend/service-account.json
    - Firebase added to the project with Email/Password auth enabled and a
      web app registered. The web SDK config is written to frontend/.env.local
      and frontend/.firebaserc is updated.
    - A Workload Identity Federation pool + provider for GitHub Actions,
      and the service account bound to your repo. No JSON keys land in CI.
    - A GitHub repo with the code pushed and CI secrets/vars populated.

.PARAMETER ProjectId
  GCP project ID to CREATE (must be globally unique, lowercase, 6-30 chars).

.PARAMETER BillingAccount
  Billing account ID to link (format: XXXXXX-XXXXXX-XXXXXX).
  Run `gcloud billing accounts list` to find it.

.PARAMETER GithubRepo
  GitHub repo to create, format "owner/repo" (e.g. "yourname/convai").

.PARAMETER Region
  GCP region. Default us-central1.

.PARAMETER SkipRepoCreate
  If set, doesn't run `gh repo create` or push code. CI secrets are NOT set.
  Useful if you already pushed the repo manually.

.EXAMPLE
  .\scripts\bootstrap.ps1 -ProjectId convai-abc123 `
    -BillingAccount 01ABCD-234567-EFGH89 `
    -GithubRepo yourname/convai
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [Parameter(Mandatory = $true)][string]$BillingAccount,
    [Parameter(Mandatory = $true)][string]$GithubRepo,
    [string]$Region = "us-central1",
    [switch]$SkipRepoCreate
)

# Use Continue (not Stop) globally so non-terminating PowerShell errors from
# wrapper scripts (e.g. gcloud.ps1's Test-Path on Program Files when running
# under a restricted process) don't kill the whole bootstrap. We rely on
# explicit $LASTEXITCODE checks + Try-Run wrappers for real error handling.
$ErrorActionPreference = "Continue"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Write-Section($title) {
    Write-Host ""
    Write-Host "==> $title" -ForegroundColor Cyan
}

function Test-Cli($name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw "Required CLI '$name' not found in PATH. Install it and re-run."
    }
}

function Try-Run($description, $scriptBlock) {
    try {
        & $scriptBlock
        Write-Host "    ok: $description"
    } catch {
        Write-Host "    skip: $description ($_)" -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
Write-Section "Checking CLIs"
# ---------------------------------------------------------------------------
Test-Cli gcloud
Test-Cli firebase
Test-Cli gh
Test-Cli git
Test-Cli node
Write-Host "All CLIs present."

# Sanity: gcloud is logged in
$gcloudAccount = gcloud config get-value account 2>$null
if (-not $gcloudAccount) {
    throw "gcloud not authenticated. Run: gcloud auth login && gcloud auth application-default login"
}
Write-Host "gcloud account: $gcloudAccount"

# ---------------------------------------------------------------------------
Write-Section "Creating GCP project: $ProjectId"
# ---------------------------------------------------------------------------
Try-Run "create project" {
    gcloud projects create $ProjectId --name="Conversational AI" 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "project create failed (may already exist)" }
}
gcloud config set project $ProjectId 2>&1 | Out-Host

# ---------------------------------------------------------------------------
Write-Section "Linking billing account"
# ---------------------------------------------------------------------------
Try-Run "link billing" {
    gcloud billing projects link $ProjectId --billing-account=$BillingAccount 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "billing link failed" }
}

# ---------------------------------------------------------------------------
Write-Section "Enabling APIs"
# ---------------------------------------------------------------------------
$apis = @(
    "run.googleapis.com",
    "firestore.googleapis.com",
    "storage.googleapis.com",
    "aiplatform.googleapis.com",
    "discoveryengine.googleapis.com",
    "identitytoolkit.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "serviceusage.googleapis.com"
)
# Some Google projects (esp. recently-created via Console) fail bulk-enable
# even when individual enables succeed; we don't halt on this because the
# script is re-runnable and APIs may already be on.
Try-Run "bulk enable APIs" {
    gcloud services enable $apis --project=$ProjectId 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "bulk API enable returned non-zero" }
}
# Whether bulk succeeded or not, verify what's actually enabled
$enabled = gcloud services list --enabled --project=$ProjectId --format="value(config.name)" 2>$null
$missing = $apis | Where-Object { $enabled -notcontains $_ }
if ($missing.Count -gt 0) {
    Write-Host "Missing APIs, trying one-by-one: $($missing -join ', ')" -ForegroundColor Yellow
    foreach ($api in $missing) {
        gcloud services enable $api --project=$ProjectId --quiet 2>&1 | Out-Host
    }
}
Write-Host "$($apis.Count) APIs verified enabled."

# ---------------------------------------------------------------------------
Write-Section "Creating Firestore (Native mode) in $Region"
# ---------------------------------------------------------------------------
Try-Run "create firestore" {
    gcloud firestore databases create --location=$Region --project=$ProjectId 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "firestore create failed (may already exist)" }
}

# ---------------------------------------------------------------------------
Write-Section "Creating Cloud Storage bucket"
# ---------------------------------------------------------------------------
$bucket = "$ProjectId-uploads"
Try-Run "create bucket gs://$bucket" {
    gcloud storage buckets create "gs://$bucket" `
        --location=$Region `
        --uniform-bucket-level-access `
        --project=$ProjectId 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "bucket create failed (may already exist)" }
}

# ---------------------------------------------------------------------------
Write-Section "Creating runtime service account"
# ---------------------------------------------------------------------------
$saName = "convai-backend"
$saEmail = "$saName@$ProjectId.iam.gserviceaccount.com"

Try-Run "create service account $saEmail" {
    gcloud iam service-accounts create $saName `
        --display-name="Conversational AI backend" `
        --project=$ProjectId 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "SA create failed (may already exist)" }
}

# Roles the SA needs at RUNTIME (read/write Firestore, Storage, Vertex, etc.)
# AND at DEPLOY time (Cloud Run admin, Cloud Build, Artifact Registry).
# In prod you'd split runtime vs deploy SAs; for dev we keep one for simplicity.
$roles = @(
    "roles/datastore.user",
    "roles/storage.objectAdmin",
    "roles/aiplatform.user",
    "roles/discoveryengine.admin",
    "roles/firebase.admin",
    "roles/firebasehosting.admin",
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/cloudbuild.builds.editor",
    "roles/artifactregistry.admin",
    "roles/logging.logWriter"
)
foreach ($role in $roles) {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$saEmail" `
        --role=$role `
        --condition=None `
        --quiet 2>&1 | Out-Null
}
Write-Host "$($roles.Count) roles bound to $saEmail."

# ---------------------------------------------------------------------------
Write-Section "Generating local dev service account key"
# ---------------------------------------------------------------------------
$keyPath = Join-Path $repoRoot "backend\service-account.json"
if (Test-Path $keyPath) {
    Write-Host "    skip: $keyPath already exists" -ForegroundColor Yellow
} else {
    gcloud iam service-accounts keys create $keyPath `
        --iam-account=$saEmail `
        --project=$ProjectId 2>&1 | Out-Host
    Write-Host "    key written to $keyPath (gitignored)"
}

# ---------------------------------------------------------------------------
Write-Section "Adding Firebase to the project"
# ---------------------------------------------------------------------------
Try-Run "firebase projects:addfirebase" {
    firebase projects:addfirebase $ProjectId 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "addfirebase failed (may already be a Firebase project)" }
}

# ---------------------------------------------------------------------------
Write-Section "Creating Firebase web app"
# ---------------------------------------------------------------------------
$webAppName = "convai-web"

# Check if an app with this name already exists
$existingApps = firebase apps:list web --project=$ProjectId --json 2>$null
$existingAppId = $null
if ($LASTEXITCODE -eq 0 -and $existingApps) {
    try {
        $parsed = $existingApps | ConvertFrom-Json
        $match = $parsed.result | Where-Object { $_.displayName -eq $webAppName }
        if ($match) { $existingAppId = $match.appId }
    } catch {}
}

if ($existingAppId) {
    Write-Host "    skip: web app '$webAppName' already exists ($existingAppId)" -ForegroundColor Yellow
} else {
    firebase apps:create web $webAppName --project=$ProjectId 2>&1 | Out-Host
}

# Get the SDK config (JSON)
$sdkConfigRaw = firebase apps:sdkconfig web --project=$ProjectId --json 2>$null
if (-not $sdkConfigRaw) { throw "Failed to fetch Firebase web SDK config" }
$sdkConfig = ($sdkConfigRaw | ConvertFrom-Json).result.sdkConfig

# ---------------------------------------------------------------------------
Write-Section "Enabling Email/Password authentication"
# ---------------------------------------------------------------------------
$accessToken = gcloud auth print-access-token
$enableEmailBody = @{
    signIn = @{
        email = @{ enabled = $true; passwordRequired = $true }
    }
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Method Patch `
        -Uri "https://identitytoolkit.googleapis.com/admin/v2/projects/$ProjectId/config?updateMask=signIn.email" `
        -Headers @{
            Authorization  = "Bearer $accessToken"
            "Content-Type" = "application/json"
        } `
        -Body $enableEmailBody | Out-Null
    Write-Host "Email/Password auth enabled."
} catch {
    Write-Host "    warn: could not enable Email/Password via REST ($_)." -ForegroundColor Yellow
    Write-Host "    Open Firebase console > Authentication > Sign-in method to enable manually."
}

# ---------------------------------------------------------------------------
Write-Section "Writing local env files"
# ---------------------------------------------------------------------------
$backendEnv = @"
GCP_PROJECT_ID=$ProjectId
GCP_LOCATION=$Region
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
FIREBASE_PROJECT_ID=$ProjectId
GCS_UPLOADS_BUCKET=$bucket
VERTEX_LOCATION=$Region
GEMINI_MODEL=gemini-2.5-pro
GEMINI_FAST_MODEL=gemini-2.5-flash
APP_ENV=dev
LOG_LEVEL=INFO
FRONTEND_ORIGIN=http://localhost:5173
"@
$backendEnvPath = Join-Path $repoRoot "backend\.env"
Set-Content -Path $backendEnvPath -Value $backendEnv -Encoding ASCII
Write-Host "    wrote backend/.env"

$frontendEnv = @"
VITE_BACKEND_URL=http://localhost:8000
VITE_BACKEND_WS_URL=ws://localhost:8000
VITE_FIREBASE_API_KEY=$($sdkConfig.apiKey)
VITE_FIREBASE_AUTH_DOMAIN=$($sdkConfig.authDomain)
VITE_FIREBASE_PROJECT_ID=$($sdkConfig.projectId)
VITE_FIREBASE_STORAGE_BUCKET=$($sdkConfig.storageBucket)
VITE_FIREBASE_MESSAGING_SENDER_ID=$($sdkConfig.messagingSenderId)
VITE_FIREBASE_APP_ID=$($sdkConfig.appId)
"@
$frontendEnvPath = Join-Path $repoRoot "frontend\.env.local"
Set-Content -Path $frontendEnvPath -Value $frontendEnv -Encoding ASCII
Write-Host "    wrote frontend/.env.local"

# Update .firebaserc with the project ID
$firebasercPath = Join-Path $repoRoot "frontend\.firebaserc"
$firebaserc = @{ projects = @{ default = $ProjectId } } | ConvertTo-Json -Depth 5
Set-Content -Path $firebasercPath -Value $firebaserc -Encoding ASCII
Write-Host "    updated frontend/.firebaserc"

# ---------------------------------------------------------------------------
Write-Section "Setting up Workload Identity Federation for GitHub"
# ---------------------------------------------------------------------------
$projectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"

Try-Run "create WIF pool 'github-pool'" {
    gcloud iam workload-identity-pools create github-pool `
        --location=global `
        --display-name="GitHub Actions" `
        --project=$ProjectId 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "pool create failed (may exist)" }
}

# Restrict the OIDC provider to ONLY this repo. This is critical — without an
# attribute condition, ANY GitHub repo could try to impersonate the SA.
$attrCondition = "assertion.repository == '$GithubRepo'"

Try-Run "create OIDC provider 'github-provider'" {
    gcloud iam workload-identity-pools providers create-oidc github-provider `
        --location=global `
        --workload-identity-pool=github-pool `
        --display-name="GitHub OIDC" `
        --issuer-uri="https://token.actions.githubusercontent.com" `
        --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" `
        --attribute-condition=$attrCondition `
        --project=$ProjectId 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "provider create failed (may exist)" }
}

# Bind the service account so the GH repo can impersonate it
$principal = "principalSet://iam.googleapis.com/projects/$projectNumber/locations/global/workloadIdentityPools/github-pool/attribute.repository/$GithubRepo"
gcloud iam service-accounts add-iam-policy-binding $saEmail `
    --member=$principal `
    --role=roles/iam.workloadIdentityUser `
    --project=$ProjectId 2>&1 | Out-Host

$wifProvider = "projects/$projectNumber/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
Write-Host "WIF provider: $wifProvider"

# ---------------------------------------------------------------------------
Write-Section "Initializing git + creating GitHub repo"
# ---------------------------------------------------------------------------
if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
    git init 2>&1 | Out-Host
    git add . 2>&1 | Out-Host
    git commit -m "Initial scaffold" 2>&1 | Out-Host
} else {
    Write-Host "    git already initialized"
}

if ($SkipRepoCreate) {
    Write-Host "    skip: -SkipRepoCreate set; not creating GitHub repo" -ForegroundColor Yellow
} else {
    Try-Run "gh repo create $GithubRepo" {
        gh repo create $GithubRepo --private --source=. --remote=origin --push 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "gh repo create failed (may exist; check 'gh repo view $GithubRepo')" }
    }

    # ---------------------------------------------------------------------------
    Write-Section "Setting GitHub Actions secrets and variables"
    # ---------------------------------------------------------------------------
    function Set-GhSecret($name, $value) {
        $value | gh secret set $name --repo=$GithubRepo 2>&1 | Out-Null
        Write-Host "    secret: $name"
    }
    function Set-GhVar($name, $value) {
        $value | gh variable set $name --repo=$GithubRepo 2>&1 | Out-Null
        Write-Host "    var: $name"
    }

    Set-GhSecret "WIF_PROVIDER"        $wifProvider
    Set-GhSecret "WIF_SERVICE_ACCOUNT" $saEmail

    Set-GhVar "GCP_PROJECT_ID" $ProjectId
    Set-GhVar "GCP_REGION"     $Region
    Set-GhVar "FRONTEND_ORIGIN" "https://$ProjectId.web.app"

    Set-GhVar "VITE_BACKEND_URL"     ""    # filled in after first backend deploy
    Set-GhVar "VITE_BACKEND_WS_URL"  ""

    Set-GhVar "VITE_FIREBASE_API_KEY"             $sdkConfig.apiKey
    Set-GhVar "VITE_FIREBASE_AUTH_DOMAIN"         $sdkConfig.authDomain
    Set-GhVar "VITE_FIREBASE_PROJECT_ID"          $sdkConfig.projectId
    Set-GhVar "VITE_FIREBASE_STORAGE_BUCKET"      $sdkConfig.storageBucket
    Set-GhVar "VITE_FIREBASE_MESSAGING_SENDER_ID" $sdkConfig.messagingSenderId
    Set-GhVar "VITE_FIREBASE_APP_ID"              $sdkConfig.appId
}

# ---------------------------------------------------------------------------
Write-Section "Done"
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Bootstrap complete." -ForegroundColor Green
Write-Host ""
Write-Host "Summary:"
Write-Host "  GCP project:   $ProjectId  (number $projectNumber)"
Write-Host "  Region:        $Region"
Write-Host "  Service acct:  $saEmail"
Write-Host "  Bucket:        gs://$bucket"
Write-Host "  Firebase app:  $($sdkConfig.appId)"
Write-Host "  WIF provider:  $wifProvider"
if (-not $SkipRepoCreate) {
    Write-Host "  GitHub repo:   https://github.com/$GithubRepo"
}
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Run the backend locally:"
Write-Host "       cd backend; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -e `".[dev]`"; uvicorn app.main:app --reload --port 8000"
Write-Host "  2. Run the frontend:"
Write-Host "       cd frontend; npm install; npm run dev"
Write-Host "  3. To deploy: push to main, OR run scripts\deploy-backend.ps1 / scripts\deploy-frontend.ps1"
Write-Host ""
Write-Host "Note: After the first backend deploy, set GitHub repo vars VITE_BACKEND_URL"
Write-Host "and VITE_BACKEND_WS_URL to the Cloud Run service URL, then re-trigger the frontend workflow."
