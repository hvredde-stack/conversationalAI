<#
.SYNOPSIS
  Build and deploy the frontend to Firebase Hosting from your local machine.

.DESCRIPTION
  Builds with frontend/.env.local (or .env.production if present) and runs
  `firebase deploy --only hosting`. CI does the same thing in
  .github/workflows/frontend-deploy.yml.

.EXAMPLE
  .\scripts\deploy-frontend.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location (Join-Path $repoRoot "frontend")

if (-not (Test-Path ".env.local") -and -not (Test-Path ".env.production")) {
    throw "No .env.local or .env.production in frontend/. Run bootstrap.ps1 first."
}

Write-Host "Building frontend..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Cyan
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { throw "Deploy failed." }

Write-Host ""
Write-Host "Deployed." -ForegroundColor Green
