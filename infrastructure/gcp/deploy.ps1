#!/usr/bin/env pwsh
# GCP Cloud Run Deployment Script for Windows PowerShell
# Run from the project root: .\infrastructure\gcp\deploy.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,

    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1",

    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "ai-whiteboard-backend"
)

function Write-Step { param($msg) Write-Host "`n➜ $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Err { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }

Write-Host "`n🚀 AI Whiteboard - GCP Cloud Run Deployment" -ForegroundColor Magenta
Write-Host "Project: $ProjectId | Region: $Region`n"

# ── 1. Check gcloud ────────────────────────────────────────────────────────
Write-Step "Checking gcloud CLI..."
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Err "gcloud CLI not found."
    Write-Host "Install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}
Write-Success "gcloud found: $(gcloud --version | Select-Object -First 1)"

# ── 2. Auth & project ──────────────────────────────────────────────────────
Write-Step "Setting GCP project..."
gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { Write-Err "Failed to set project"; exit 1 }
Write-Success "Project set to $ProjectId"

# ── 3. Enable APIs ─────────────────────────────────────────────────────────
Write-Step "Enabling required GCP APIs (this may take a minute)..."
$apis = @(
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com"
)
foreach ($api in $apis) {
    gcloud services enable $api --quiet
}
Write-Success "APIs enabled"

# ── 4. Collect secrets ─────────────────────────────────────────────────────
Write-Host "`n📋 We need to store your secrets securely in GCP Secret Manager." -ForegroundColor Yellow

$anthropicKey = Read-Host "Enter your Anthropic API key"
$firebaseProjectId = Read-Host "Enter your Firebase Project ID"

Write-Host "`nFor the Firebase Service Account:"
Write-Host "1. Go to Firebase Console → Project Settings → Service accounts"
Write-Host "2. Click 'Generate new private key'"
Write-Host "3. Save the JSON file, then paste its full path below"
$serviceAccountPath = Read-Host "Path to Firebase service account JSON file"

if (-not (Test-Path $serviceAccountPath)) {
    Write-Err "Service account file not found at: $serviceAccountPath"
    exit 1
}
$serviceAccountJson = Get-Content $serviceAccountPath -Raw

$frontendUrl = Read-Host "Enter your frontend URL (e.g. https://your-app.web.app)"

# ── 5. Store secrets ───────────────────────────────────────────────────────
Write-Step "Storing secrets in Secret Manager..."

function Set-GcpSecret {
    param($name, $value)
    $tempFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tempFile -Value $value -NoNewline -Encoding UTF8
    $existing = gcloud secrets describe $name --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        gcloud secrets versions add $name --data-file=$tempFile --quiet
        Write-Host "  Updated secret: $name" -ForegroundColor Gray
    } else {
        gcloud secrets create $name --data-file=$tempFile --replication-policy=automatic --quiet
        Write-Host "  Created secret: $name" -ForegroundColor Gray
    }
    Remove-Item $tempFile
}

Set-GcpSecret "anthropic-api-key"          $anthropicKey
Set-GcpSecret "firebase-service-account"   $serviceAccountJson
Set-GcpSecret "firebase-project-id"        $firebaseProjectId
Set-GcpSecret "allowed-origins"            $frontendUrl

Write-Success "Secrets stored"

# ── 6. Build & deploy ──────────────────────────────────────────────────────
Write-Step "Building and deploying to Cloud Run (this takes ~3 minutes)..."
Push-Location backend

gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --port 8080 `
    --set-env-vars "NODE_ENV=production,PORT=8080" `
    --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest,FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest,FIREBASE_PROJECT_ID=firebase-project-id:latest,ALLOWED_ORIGINS=allowed-origins:latest,REDIS_URL=redis-url:latest" `
    --quiet

Pop-Location

if ($LASTEXITCODE -ne 0) { Write-Err "Deployment failed"; exit 1 }

# ── 7. Get service URL ─────────────────────────────────────────────────────
Write-Step "Getting service URL..."
$serviceUrl = gcloud run services describe $ServiceName `
    --region $Region `
    --format "value(status.url)"

Write-Success "Backend deployed!"

# ── 8. Health check ────────────────────────────────────────────────────────
Write-Step "Running health check..."
Start-Sleep -Seconds 5
try {
    $response = Invoke-WebRequest -Uri "$serviceUrl/health" -UseBasicParsing -TimeoutSec 15
    if ($response.StatusCode -eq 200) {
        Write-Success "Health check passed!"
    }
} catch {
    Write-Host "⚠ Health check failed - service may still be starting up" -ForegroundColor Yellow
}

# ── 9. Done ────────────────────────────────────────────────────────────────
Write-Host "`n" + ("═" * 56) -ForegroundColor Magenta
Write-Host "  🎉 Backend Deployed Successfully!" -ForegroundColor Green
Write-Host "═" * 56 -ForegroundColor Magenta
Write-Host ""
Write-Host "  Backend URL:  $serviceUrl" -ForegroundColor Cyan
Write-Host "  Health:       $serviceUrl/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next step — deploy the frontend:" -ForegroundColor Yellow
Write-Host "  1. Update frontend/.env.production:"
Write-Host "     VITE_BACKEND_URL=$serviceUrl"
Write-Host "  2. cd frontend"
Write-Host "  3. npm run build"
Write-Host "  4. firebase deploy --only hosting"
Write-Host ""
