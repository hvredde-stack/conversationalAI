<#
.SYNOPSIS
  Creates the GitHub repo and sets all CI secrets/variables.

.DESCRIPTION
  Run this in YOUR own PowerShell (not via Claude) because `gh` auth lives in
  the user's credential store, which sandboxed tooling can't read.

  Reads values from frontend/.env.local (written by bootstrap.ps1).

.EXAMPLE
  .\scripts\setup-github.ps1 -GithubRepo hvredde-stack/conversationalAI
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$GithubRepo,
    [string]$ProjectId = "conversational-ai-496700",
    [string]$Region = "us-central1",
    [string]$WifProvider = "projects/225011504124/locations/global/workloadIdentityPools/github-pool/providers/github-provider",
    [string]$ServiceAccount = "convai-backend@conversational-ai-496700.iam.gserviceaccount.com"
)

$ErrorActionPreference = "Continue"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

# Sanity: gh authed
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "gh not authenticated. Run: gh auth login" -ForegroundColor Red
    exit 1
}

# Read frontend/.env.local for Firebase config
$envPath = Join-Path $repoRoot "frontend\.env.local"
if (-not (Test-Path $envPath)) {
    Write-Host "frontend/.env.local missing. Run bootstrap.ps1 first." -ForegroundColor Red
    exit 1
}
$envVars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$') {
        $envVars[$Matches[1]] = $Matches[2]
    }
}

Write-Host "==> Creating GitHub repo $GithubRepo (if missing)" -ForegroundColor Cyan
gh repo view $GithubRepo 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    gh repo create $GithubRepo --private --source=. --remote=origin --push 2>&1 | Out-Host
} else {
    Write-Host "    repo already exists; adding remote + pushing"
    git remote get-url origin 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        git remote add origin "https://github.com/$GithubRepo.git" 2>&1 | Out-Host
    }
    git push -u origin master 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        # default branch might be 'main' on fresh repo
        git branch -M main 2>&1 | Out-Null
        git push -u origin main 2>&1 | Out-Host
    }
}

Write-Host "`n==> Setting GitHub Actions secrets" -ForegroundColor Cyan
function Set-GhSecret($name, $value) {
    $out = $value | gh secret set $name --repo=$GithubRepo 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    secret: $name"
    } else {
        Write-Host "    FAIL secret: $name -- $out" -ForegroundColor Red
    }
}
function Set-GhVar($name, $value) {
    $out = $value | gh variable set $name --repo=$GithubRepo 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    var: $name"
    } else {
        Write-Host "    FAIL var: $name -- $out" -ForegroundColor Red
    }
}

Set-GhSecret "WIF_PROVIDER"        $WifProvider
Set-GhSecret "WIF_SERVICE_ACCOUNT" $ServiceAccount

Write-Host "`n==> Setting GitHub Actions variables" -ForegroundColor Cyan
Set-GhVar "GCP_PROJECT_ID"   $ProjectId
Set-GhVar "GCP_REGION"       $Region
Set-GhVar "FRONTEND_ORIGIN"  "https://$ProjectId.web.app"

# Will be set after first backend deploy
Set-GhVar "VITE_BACKEND_URL"    ""
Set-GhVar "VITE_BACKEND_WS_URL" ""

Set-GhVar "VITE_FIREBASE_API_KEY"             $envVars["VITE_FIREBASE_API_KEY"]
Set-GhVar "VITE_FIREBASE_AUTH_DOMAIN"         $envVars["VITE_FIREBASE_AUTH_DOMAIN"]
Set-GhVar "VITE_FIREBASE_PROJECT_ID"          $envVars["VITE_FIREBASE_PROJECT_ID"]
Set-GhVar "VITE_FIREBASE_STORAGE_BUCKET"      $envVars["VITE_FIREBASE_STORAGE_BUCKET"]
Set-GhVar "VITE_FIREBASE_MESSAGING_SENDER_ID" $envVars["VITE_FIREBASE_MESSAGING_SENDER_ID"]
Set-GhVar "VITE_FIREBASE_APP_ID"              $envVars["VITE_FIREBASE_APP_ID"]

Write-Host "`nDone." -ForegroundColor Green
Write-Host "Repo: https://github.com/$GithubRepo"
