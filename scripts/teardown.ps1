<#
.SYNOPSIS
  Tear down GCP project and GitHub repo created by bootstrap.ps1.

.DESCRIPTION
  Schedules deletion of the GCP project (Google holds it for 30 days before
  permanent deletion — you can restore in that window). Optionally also
  deletes the GitHub repo and removes local generated files.

  Requires explicit confirmation. NOT idempotent — running again on an
  already-deleted project will fail loudly.

.PARAMETER ProjectId
  GCP project to delete.

.PARAMETER GithubRepo
  GitHub repo to delete, format "owner/repo". Optional. If omitted, the GH
  repo is left intact.

.PARAMETER PurgeLocal
  Also delete backend/service-account.json, backend/.env, frontend/.env.local.

.EXAMPLE
  .\scripts\teardown.ps1 -ProjectId convai-abc123 -GithubRepo me/convai -PurgeLocal
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [string]$GithubRepo,
    [switch]$PurgeLocal
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "About to delete:" -ForegroundColor Yellow
Write-Host "  GCP project:  $ProjectId  (everything inside it)"
if ($GithubRepo) { Write-Host "  GitHub repo:  $GithubRepo" }
if ($PurgeLocal) { Write-Host "  Local files:  backend/service-account.json, backend/.env, frontend/.env.local" }
Write-Host ""
$confirm = Read-Host "Type the project ID to confirm"
if ($confirm -ne $ProjectId) {
    Write-Host "Cancelled." -ForegroundColor Yellow
    return
}

Write-Host "Deleting GCP project (30-day grace period, restorable)..." -ForegroundColor Cyan
gcloud projects delete $ProjectId --quiet 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Host "Project delete returned non-zero (may already be deleted)." -ForegroundColor Yellow }

if ($GithubRepo) {
    Write-Host "Deleting GitHub repo..." -ForegroundColor Cyan
    gh repo delete $GithubRepo --yes 2>&1 | Out-Host
}

if ($PurgeLocal) {
    Write-Host "Removing local generated files..." -ForegroundColor Cyan
    foreach ($p in @("backend\service-account.json", "backend\.env", "frontend\.env.local")) {
        $full = Join-Path $repoRoot $p
        if (Test-Path $full) { Remove-Item $full -Force; Write-Host "  removed $p" }
    }
}

Write-Host ""
Write-Host "Teardown complete." -ForegroundColor Green
Write-Host "To restore the GCP project within 30 days: gcloud projects undelete $ProjectId"
