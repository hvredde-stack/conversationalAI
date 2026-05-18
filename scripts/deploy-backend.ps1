<#
.SYNOPSIS
  Deploy the backend to Cloud Run from your local machine.

.DESCRIPTION
  Uses your local gcloud auth. CI does the same thing in
  .github/workflows/backend-deploy.yml. Reads project/region from backend/.env.

.EXAMPLE
  .\scripts\deploy-backend.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location (Join-Path $repoRoot "backend")

# Read backend/.env into a hashtable
$envFile = ".\.env"
if (-not (Test-Path $envFile)) { throw "backend/.env not found. Run bootstrap.ps1 first." }
$cfg = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$') {
        $cfg[$Matches[1]] = $Matches[2]
    }
}

$projectId = $cfg.GCP_PROJECT_ID
$region    = $cfg.GCP_LOCATION
$saEmail   = "convai-backend@$projectId.iam.gserviceaccount.com"
$frontendOrigin = if ($cfg.FRONTEND_ORIGIN -and $cfg.FRONTEND_ORIGIN -ne "http://localhost:5173") {
    $cfg.FRONTEND_ORIGIN
} else {
    "https://$projectId.web.app"
}

$envVars = @(
    "GCP_PROJECT_ID=$projectId",
    "FIREBASE_PROJECT_ID=$projectId",
    "GCS_UPLOADS_BUCKET=$projectId-uploads",
    "VERTEX_LOCATION=$region",
    "GEMINI_MODEL=$($cfg.GEMINI_MODEL)",
    "GEMINI_FAST_MODEL=$($cfg.GEMINI_FAST_MODEL)",
    "APP_ENV=prod",
    "FRONTEND_ORIGIN=$frontendOrigin"
) -join ","

Write-Host "Deploying convai-backend to $region as $saEmail..." -ForegroundColor Cyan

gcloud run deploy convai-backend `
    --source . `
    --project $projectId `
    --region $region `
    --service-account $saEmail `
    --allow-unauthenticated `
    --quiet `
    --set-env-vars $envVars

if ($LASTEXITCODE -ne 0) { throw "Cloud Run deploy failed." }

$url = gcloud run services describe convai-backend --project=$projectId --region=$region --format="value(status.url)"
Write-Host ""
Write-Host "Deployed: $url" -ForegroundColor Green
Write-Host "Set these GitHub repo variables before deploying the frontend:"
Write-Host "  VITE_BACKEND_URL=$url"
Write-Host "  VITE_BACKEND_WS_URL=$($url -replace '^https://', 'wss://')"
