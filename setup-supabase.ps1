# AI Whiteboard - Windows Setup Wizard (Supabase Edition)
# Run this in PowerShell: .\setup-supabase.ps1

$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "White"
Clear-Host

function Write-Header { param($msg) Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Magenta; Write-Host "║  $msg" -ForegroundColor Magenta; Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta }
function Write-Step { param($msg) Write-Host "➜ " -NoNewline -ForegroundColor Cyan; Write-Host $msg }
function Write-Success { param($msg) Write-Host "✓ " -NoNewline -ForegroundColor Green; Write-Host $msg }
function Write-Err { param($msg) Write-Host "✗ " -NoNewline -ForegroundColor Red; Write-Host $msg }
function Prompt-Continue { Write-Host ""; Write-Host "Press Enter to continue..." -ForegroundColor Gray; Read-Host; Write-Host "" }

Write-Host @"
    ___    ____   _       ____    _     __           __
   /   |  /  _/  | |     / / /_  (_)_  / /__  ____  / /
  / /| |  / /    | | /| / / __ \/ / __ / / _ \/ __ \/ /
 / ___ |_/ /     | |/ |/ / / / / / / /_/ /  __/ /_/ / /
/_/  |_/___/     |__/|__/_/ /_/_/\____/\_/ /_/____/_/
                                                    
         Supabase + AI + Real-time Collaboration
         Windows Setup Wizard
"@ -ForegroundColor Magenta

Write-Header "Welcome to AI Whiteboard Setup (Supabase Edition)!"

Write-Host "This wizard will help you:"
Write-Host "  1. Check prerequisites"
Write-Host "  2. Set up Supabase"
Write-Host "  3. Configure environment"
Write-Host "  4. Install dependencies"
Write-Host "  5. Start the application"
Write-Host ""
Write-Host "Estimated time: 10 minutes (simpler than Firebase!)"
Prompt-Continue

# Check Node.js
Write-Header "Step 1: Checking Prerequisites"
Write-Step "Checking Node.js..."
try {
    $nodeVersion = node --version
    Write-Success "Node.js found: $nodeVersion"
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNumber -lt 20) { Write-Host "  ⚠ Node.js 20+ recommended" -ForegroundColor Yellow }
} catch {
    Write-Err "Node.js not found. Install from: https://nodejs.org"
    exit 1
}

Write-Step "Checking npm..."
try {
    $npmVersion = npm --version
    Write-Success "npm found: $npmVersion"
} catch {
    Write-Err "npm not found"
    exit 1
}

Write-Success "Prerequisites check complete!"
Prompt-Continue

# Supabase Setup
Write-Header "Step 2: Supabase Setup"

Write-Host "Let's set up Supabase (much simpler than Firebase!):`n" -ForegroundColor Cyan
Write-Host "1. Go to: " -NoNewline; Write-Host "https://supabase.com" -ForegroundColor Cyan
Write-Host "2. Sign in with GitHub (easiest)"
Write-Host "3. Click 'New project'"
Write-Host "4. Fill in:"
Write-Host "   - Name: ai-whiteboard"
Write-Host "   - Generate strong password (SAVE IT!)"
Write-Host "   - Region: Choose closest to you"
Write-Host "   - Plan: Free"
Write-Host "5. Wait 2 minutes for project to provision`n"

$openBrowser = Read-Host "Open Supabase in browser? (y/n)"
if ($openBrowser -eq 'y') { Start-Process "https://supabase.com" }

$projectCreated = Read-Host "`nHave you created your Supabase project? (y/n)"
if ($projectCreated -ne 'y') { Write-Host "Please create project first, then run this script again." -ForegroundColor Yellow; exit 1 }

Write-Success "Supabase project created!"
Prompt-Continue

# Database Schema
Write-Header "Step 3: Set Up Database"

Write-Host "Now let's create the database tables:`n" -ForegroundColor Cyan
Write-Host "1. In Supabase, click 'SQL Editor' (left sidebar)"
Write-Host "2. Click '+ New query'"
Write-Host "3. Open the file: " -NoNewline; Write-Host "supabase-schema.sql" -ForegroundColor Yellow
Write-Host "4. Copy ALL contents (Ctrl+A, Ctrl+C)"
Write-Host "5. Paste into SQL Editor (Ctrl+V)"
Write-Host "6. Click 'Run' (bottom right)"
Write-Host "7. You should see: 'Database schema created successfully!'`n"

$schemaRun = Read-Host "Have you run the schema? (y/n)"
if ($schemaRun -ne 'y') { Write-Host "Please run the schema, then continue." -ForegroundColor Yellow; exit 1 }

Write-Success "Database schema created!"
Prompt-Continue

# Get API Keys
Write-Header "Step 4: Get Supabase API Keys"

Write-Host "Just 2 simple keys (way easier than Firebase!):`n" -ForegroundColor Cyan
Write-Host "1. In Supabase, click 'Settings' (gear icon, bottom left)"
Write-Host "2. Click 'API'"
Write-Host "3. Copy these 3 values:`n"

Write-Host "Please enter your Supabase values:" -ForegroundColor Yellow

$SUPABASE_URL = Read-Host "`nProject URL (https://xxx.supabase.co)"
$SUPABASE_ANON_KEY = Read-Host "anon public key (eyJhbGc...)"
$SUPABASE_SERVICE_KEY = Read-Host "service_role key (eyJhbGc...)"

Write-Host ""
Write-Success "Supabase keys collected!"

# Anthropic API Key
Write-Host "`nFor AI features, you need an Anthropic API key." -ForegroundColor Cyan
Write-Host "Get one at: https://console.anthropic.com`n"

$hasApiKey = Read-Host "Do you have an Anthropic API key? (y/n)"
if ($hasApiKey -eq 'y') {
    $ANTHROPIC_API_KEY = Read-Host "Enter your Anthropic API key"
} else {
    Write-Host "Skipping AI features for now (add later)" -ForegroundColor Yellow
    $ANTHROPIC_API_KEY = "your_api_key_here"
}

Prompt-Continue

# Create environment files
Write-Header "Step 5: Creating Environment Files"

Write-Step "Creating backend\.env..."
$backendEnv = @"
NODE_ENV=development
PORT=8080
HOST=0.0.0.0

SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY

ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ANTHROPIC_MODEL=claude-sonnet-4-20250514

ALLOWED_ORIGINS=http://localhost:3000

LOG_LEVEL=info
ENABLE_METRICS=true
"@
Set-Content -Path "backend\.env" -Value $backendEnv
Write-Success "backend\.env created"

Write-Step "Creating frontend\.env.local..."
$frontendEnv = @"
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

VITE_BACKEND_URL=http://localhost:8080
"@
Set-Content -Path "frontend\.env.local" -Value $frontendEnv
Write-Success "frontend\.env.local created"

Prompt-Continue

# Install dependencies
Write-Header "Step 6: Installing Dependencies"

Write-Host "This may take a few minutes...`n" -ForegroundColor Yellow

Write-Step "Installing backend dependencies..."
Push-Location backend
npm install --silent
Pop-Location
Write-Success "Backend dependencies installed"

Write-Step "Installing frontend dependencies..."
Push-Location frontend
npm install --silent
Pop-Location
Write-Success "Frontend dependencies installed"

Prompt-Continue

# Create start scripts
Write-Header "Step 7: Creating Start Scripts"

$backendStart = @"
@echo off
echo Starting Backend Server...
cd backend
npm run dev
"@
Set-Content -Path "start-backend.bat" -Value $backendStart
Write-Success "Created start-backend.bat"

$frontendStart = @"
@echo off
echo Starting Frontend Server...
cd frontend
npm run dev
"@
Set-Content -Path "start-frontend.bat" -Value $frontendStart
Write-Success "Created start-frontend.bat"

Prompt-Continue

# Setup complete
Write-Header "🎉 Setup Complete!"

Write-Host "Your AI Whiteboard is ready to use!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 To start the application:`n" -ForegroundColor Cyan
Write-Host "1. Start Backend (new terminal):"
Write-Host "   " -NoNewline; Write-Host ".\start-backend.bat" -ForegroundColor Green
Write-Host "   or: cd backend && npm run dev`n"
Write-Host "2. Start Frontend (another new terminal):"
Write-Host "   " -NoNewline; Write-Host ".\start-frontend.bat" -ForegroundColor Green
Write-Host "   or: cd frontend && npm run dev`n"
Write-Host "3. Open browser to:"
Write-Host "   " -NoNewline; Write-Host "http://localhost:3000`n" -ForegroundColor Cyan

Write-Host "🔗 Useful Information:`n" -ForegroundColor Cyan
Write-Host "  • Backend:    http://localhost:8080"
Write-Host "  • Frontend:   http://localhost:3000"
Write-Host "  • Supabase:   https://app.supabase.com`n"

Write-Host "📚 Documentation:`n" -ForegroundColor Cyan
Write-Host "  • WINDOWS_SETUP_SUPABASE.md  - Complete guide"
Write-Host "  • SUPABASE_SETUP.md          - Supabase details"
Write-Host "  • RENDER_DEPLOYMENT_SUPABASE.md - Deploy guide"
Write-Host "  • AI_EXAMPLES.md             - AI commands`n"

# Save setup info
$setupInfo = @"
AI Whiteboard Setup Information (Supabase Edition)
Generated: $(Get-Date)

Supabase Project URL: $SUPABASE_URL
Backend Port: 8080
Frontend URL: http://localhost:3000

Start Commands:
  Backend:  start-backend.bat  (or: cd backend && npm run dev)
  Frontend: start-frontend.bat (or: cd frontend && npm run dev)

Supabase Dashboard: https://app.supabase.com

For help, see:
  - WINDOWS_SETUP_SUPABASE.md
  - SUPABASE_SETUP.md
"@
Set-Content -Path "SETUP_INFO.txt" -Value $setupInfo
Write-Success "Setup information saved to SETUP_INFO.txt"

Write-Host ""
Write-Host "🎯 What makes Supabase easier than Firebase:`n" -ForegroundColor Cyan
Write-Host "  ✓ Just 2 API keys (not 7 variables!)"
Write-Host "  ✓ No service account JSON files"
Write-Host "  ✓ PostgreSQL (industry standard)"
Write-Host "  ✓ Built-in database UI"
Write-Host "  ✓ Real SQL queries`n"

Write-Host "Happy whiteboarding! 🎨" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host
