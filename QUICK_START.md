# 🚀 Quick Start - Supabase Edition

Get your AI Whiteboard running in **10 minutes**.

---

## Option 1: Automated Setup (Windows)

```powershell
# Extract the zip and run:
.\setup-supabase.ps1
```

The wizard guides you through everything!

---

## Option 2: Manual Setup

### 1. Create Supabase Project (3 min)

1. Go to **https://supabase.com** → Sign up
2. Click **"New project"**
3. Fill in:
   - Name: `ai-whiteboard`
   - Generate password (save it!)
   - Region: Closest to you
   - Plan: Free
4. Wait 2 minutes

### 2. Set Up Database (2 min)

1. In Supabase → **SQL Editor**
2. Click **"New query"**
3. Open `supabase-schema.sql` from this project
4. Copy all (Ctrl+A, Ctrl+C)
5. Paste in SQL Editor (Ctrl+V)
6. Click **"Run"**

✅ Database ready!

### 3. Get API Keys (1 min)

Supabase → **Settings** → **API**

Copy these 3 values:
- **Project URL**: `https://xxx.supabase.co`
- **anon public**: `eyJhbGc...`
- **service_role**: `eyJhbGc...` (secret!)

### 4. Configure Environment (2 min)

**Backend** - Create `backend/.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_ORIGINS=http://localhost:3000
```

**Frontend** - Create `frontend/.env.local`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_BACKEND_URL=http://localhost:8080
```

### 5. Install & Run (2 min)

```powershell
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

Open: **http://localhost:3000** 🎉

---

## Quick Commands

```powershell
# Start (after setup)
.\start-backend.bat    # Or: cd backend && npm run dev
.\start-frontend.bat   # Or: cd frontend && npm run dev

# Deploy
git push origin main   # Auto-deploys to Render
vercel                 # Deploy frontend
```

---

## Test It Works

1. Sign up with email/password
2. Draw some shapes
3. Click ✨ AI → Try: `"Create 5 circles"`
4. Open second tab → verify real-time sync

---

## Need Help?

- **Windows Setup**: `WINDOWS_SETUP_SUPABASE.md`
- **Database**: `SUPABASE_SETUP.md`
- **Deployment**: `RENDER_DEPLOYMENT_SUPABASE.md`
- **AI Examples**: `AI_EXAMPLES.md`

---

## Why Supabase?

- ✅ **2 API keys** (not 7+ variables!)
- ✅ **No service account JSON**
- ✅ **PostgreSQL** (SQL database)
- ✅ **Open source**
- ✅ **Free tier**: 500MB, 50K users

---

**Total setup time: 10 minutes** | **Cost: $0**
