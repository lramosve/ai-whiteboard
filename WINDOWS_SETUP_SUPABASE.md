# 🪟 Windows Setup Guide - Supabase Edition

Complete guide for setting up and deploying the AI Whiteboard on Windows 10/11 with Supabase.

**What makes this easier than Firebase:**
- ✅ No service account JSON files
- ✅ Just 2 API keys to copy
- ✅ Simpler environment setup
- ✅ No Redis needed

---

## 📋 Prerequisites for Windows

### Required Software

#### 1. Node.js (Required)

**Download & Install:**
1. Go to **https://nodejs.org**
2. Download **LTS version** (20.x or higher)
3. Run installer with default options
4. ✅ Check "Automatically install necessary tools"
5. Restart your computer

**Verify:**
```powershell
node --version
npm --version
```

#### 2. Git (Optional but Recommended)

**Download & Install:**
1. Go to **https://git-scm.com/download/win**
2. Download and run installer
3. Use default settings

---

## Part 1: Supabase Setup (5 minutes)

### Step 1: Create Supabase Account

1. Open browser to **https://supabase.com**
2. Click **"Start your project"**
3. Sign in with **GitHub** (easiest)
4. Click **"New project"**

### Step 2: Create Project

Fill in:
- **Name**: `ai-whiteboard`
- **Database Password**: Click "Generate a password" → **Save this somewhere!**
- **Region**: Choose closest to you (e.g., "East US")
- **Pricing Plan**: **Free**

Click **"Create new project"**

Wait ~2 minutes for provisioning.

### Step 3: Set Up Database

1. In your Supabase project, click **"SQL Editor"** (left sidebar)
2. Click **"+ New query"**
3. **On your computer**: Navigate to where you extracted the zip
4. Open `supabase-schema.sql` in **Notepad**
5. Press **Ctrl+A** (select all), **Ctrl+C** (copy)
6. **Back in Supabase**: Click in the SQL editor, **Ctrl+V** (paste)
7. Click **"Run"** (bottom right corner)

You should see:
```
Database schema created successfully!
```

✅ **Database is ready!**

### Step 4: Enable Email Authentication

1. Click **"Authentication"** (left sidebar)
2. Click **"Providers"**
3. **Email** should already be enabled ✅

*Optional: Enable Google OAuth (see SUPABASE_SETUP.md for details)*

### Step 5: Get Your API Keys

**This is the easiest part - just 2 keys!**

1. Click **"Settings"** (gear icon, bottom left)
2. Click **"API"**
3. You'll see:

**Copy these 3 values to Notepad:**

| What to Copy | Example | Where to Use |
|--------------|---------|--------------|
| **Project URL** | `https://abcdefgh.supabase.co` | Backend + Frontend |
| **anon public** key | `eyJhbGciOiJIUzI1Ni...` | Backend + Frontend |
| **service_role** key | `eyJhbGciOiJIUzI1Ni...` | Backend only (secret!) |

**Important:** Keep these safe! Don't commit to Git.

✅ **Supabase setup complete!**

---

## Part 2: Local Development Setup

### Step 1: Extract the Project

1. Extract `whiteboard-supabase.zip`
2. You should have a folder structure like:
   ```
   ai-whiteboard/
   ├── backend/
   ├── frontend/
   ├── supabase-schema.sql
   └── README.md
   ```

### Step 2: Install Dependencies

Open **PowerShell** (not as administrator):

```powershell
# Navigate to project
cd path\to\ai-whiteboard

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ..\frontend
npm install

# Go back to root
cd ..
```

This takes 2-3 minutes.

### Step 3: Configure Backend

**Create** `backend\.env` (copy from `.env.example`):

```powershell
cd backend
copy .env.example .env
notepad .env
```

**Fill in** (paste your values from Step 5 above):

```bash
NODE_ENV=development
PORT=8080

# Supabase (paste your values from Supabase dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Anthropic (get from https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-api03-...

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

**Save** (Ctrl+S) and close Notepad.

### Step 4: Configure Frontend

```powershell
cd ..\frontend
copy .env.example .env.local
notepad .env.local
```

**Fill in** (same Supabase values):

```bash
# Supabase (same URL and anon key as backend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend
VITE_BACKEND_URL=http://localhost:8080
```

**Save** and close.

### Step 5: Start the Application

**Open TWO PowerShell windows:**

**Terminal 1 - Backend:**
```powershell
cd path\to\ai-whiteboard\backend
npm run dev
```

You should see:
```
[INFO] Supabase initialized successfully
[INFO] Server running on http://localhost:8080
```

**Terminal 2 - Frontend:**
```powershell
cd path\to\ai-whiteboard\frontend
npm run dev
```

You should see:
```
VITE ready in 500 ms
➜ Local: http://localhost:3000
```

### Step 6: Test It!

1. Open browser to **http://localhost:3000**
2. Click **"Sign Up"**
3. Enter email and password
4. Click **"Create Account"**
5. You should be logged in! ✅

**Test the whiteboard:**
- Draw some shapes
- Click **✨ AI** button
- Try: `"Create 3 blue circles"`

**Check Supabase:**
- Supabase dashboard → **Table Editor** → `board_objects`
- You should see your shapes! ✅

---

## Part 3: Deploy to Production

### Option A: Using Render.com (Recommended - Free)

See **[RENDER_DEPLOYMENT_SUPABASE.md](./RENDER_DEPLOYMENT_SUPABASE.md)** for complete guide.

**Quick version:**

#### 1. Push to GitHub

```powershell
cd path\to\ai-whiteboard

# Initialize Git (if not already)
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/ai-whiteboard.git
git push -u origin main
```

#### 2. Deploy Backend to Render

1. Go to **https://render.com** → Sign in with GitHub
2. **New +** → **Web Service**
3. Connect your `ai-whiteboard` repository
4. Settings:
   - **Name**: `ai-whiteboard-backend`
   - **Root Directory**: `backend`
   - **Environment**: **Docker**
   - **Region**: Oregon
   - **Plan**: **Free**

5. **Environment Variables** (click "Advanced" → "Add Environment Variable"):

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `SUPABASE_URL` | Paste your Supabase URL |
| `SUPABASE_ANON_KEY` | Paste your anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Paste your service role key |
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` (update later) |

6. Click **"Create Web Service"**
7. Wait 5-7 minutes

**Copy your backend URL:** `https://ai-whiteboard-backend.onrender.com`

#### 3. Deploy Frontend to Vercel

```powershell
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? ai-whiteboard
# - Directory? ./
# - Override settings? No
```

**Add environment variables in Vercel dashboard:**
1. Go to **https://vercel.com** → Your project
2. **Settings** → **Environment Variables**
3. Add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - `VITE_BACKEND_URL` = your Render backend URL

4. **Deployments** → Click "..." → **Redeploy**

**Your app is live!** 🎉

#### 4. Update CORS

1. Render → your backend → **Environment**
2. Edit `ALLOWED_ORIGINS`
3. Change to your Vercel frontend URL
4. Click **"Save Changes"**

---

## 🎯 Quick Reference

### Start Local Development:
```powershell
# Terminal 1
cd backend
npm run dev

# Terminal 2 (new window)
cd frontend
npm run dev

# Open: http://localhost:3000
```

### Environment Variables Summary:

**Backend (.env):**
- `SUPABASE_URL` - from Supabase dashboard
- `SUPABASE_ANON_KEY` - from Supabase dashboard
- `SUPABASE_SERVICE_ROLE_KEY` - from Supabase dashboard
- `ANTHROPIC_API_KEY` - from console.anthropic.com

**Frontend (.env.local):**
- `VITE_SUPABASE_URL` - same as backend
- `VITE_SUPABASE_ANON_KEY` - same as backend
- `VITE_BACKEND_URL` - http://localhost:8080 (local) or your Render URL (prod)

### Common Commands:
```powershell
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel

# Deploy to Render
git push origin main  # Auto-deploys if connected
```

---

## 🐛 Windows-Specific Troubleshooting

### "Cannot run scripts" in PowerShell

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Port already in use

```powershell
# Find what's using port 8080
netstat -ano | findstr :8080

# Kill the process
taskkill /PID <PID_NUMBER> /F
```

### "npm install" fails

```powershell
# Clear cache
npm cache clean --force

# Delete node_modules and retry
Remove-Item -Recurse -Force node_modules
npm install
```

### Environment variables not working

**Common issues:**
- Extra spaces in `.env` file
- Wrong quotes around values (don't use quotes unless value has spaces)
- File named `.env.txt` instead of `.env`

**To check your .env file:**
```powershell
Get-Content backend\.env
```

### "Supabase: session not found"

→ Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match in frontend

### Database errors

→ Make sure you ran `supabase-schema.sql` in Supabase SQL Editor

---

## 📊 What You Just Set Up

```
Windows PC
│
├── Backend (Node.js)
│   ├── Connects to Supabase (PostgreSQL)
│   ├── Handles WebSocket connections
│   └── Integrates with Claude AI
│
├── Frontend (React + Vite)
│   ├── Connects to Supabase Auth
│   └── Connects to Backend WebSocket
│
└── Supabase (Cloud)
    ├── PostgreSQL Database
    ├── Authentication
    └── Real-time Subscriptions
```

---

## 🎨 Try These AI Commands

Once your app is running:

```
"Create 5 blue circles in a row"
"Draw a flowchart with 4 steps"
"Make a 3x3 grid of squares"
"Create a simple mind map"
"Draw a timeline from 2020 to 2024"
```

See **[AI_EXAMPLES.md](./AI_EXAMPLES.md)** for 50+ examples!

---

## 💡 Pro Tips for Windows

### 1. Use Windows Terminal

Download from Microsoft Store - much better than default PowerShell!

### 2. Use VS Code

```powershell
# Install VS Code
winget install Microsoft.VisualStudioCode

# Open project
code .
```

**Recommended Extensions:**
- ESLint
- Prettier
- Tailwind CSS IntelliSense

### 3. Create Start Scripts

**Create** `start.bat` in project root:

```batch
@echo off
echo Starting AI Whiteboard...

start "Backend" cmd /k "cd backend && npm run dev"
timeout /t 2
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Backend: http://localhost:8080
echo Frontend: http://localhost:3000
echo.
echo Press any key to close all servers...
pause > nul

taskkill /F /FI "WindowTitle eq Backend*"
taskkill /F /FI "WindowTitle eq Frontend*"
```

Double-click to start both servers!

### 4. Set Up Git Bash (Alternative to PowerShell)

If you prefer Unix-like commands:
1. Install Git for Windows
2. Use Git Bash instead of PowerShell
3. All the bash commands from the guides work!

---

## 📁 Project Structure

```
ai-whiteboard/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── supabase.js       ← Supabase connection
│   │   │   └── redis.js          ← In-memory cache
│   │   ├── routes/
│   │   │   ├── auth.js           ← Authentication endpoints
│   │   │   └── boards.js         ← Board CRUD
│   │   ├── services/
│   │   │   └── aiAgent.js        ← Claude AI integration
│   │   ├── websocket/
│   │   │   └── socketHandler.js  ← Real-time sync
│   │   └── server.js             ← Entry point
│   ├── .env                      ← Your config (don't commit!)
│   ├── .env.example              ← Template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthModal.jsx
│   │   │   ├── Toolbar.jsx
│   │   │   ├── WhiteboardCanvas.jsx
│   │   │   └── AIPanel.jsx
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx   ← Supabase auth state
│   │   ├── services/
│   │   │   └── supabase.js       ← Supabase client
│   │   └── App.jsx
│   ├── .env.local                ← Your config (don't commit!)
│   ├── .env.example              ← Template
│   └── package.json
│
├── supabase-schema.sql           ← Database setup
├── SUPABASE_SETUP.md             ← Detailed Supabase guide
├── RENDER_DEPLOYMENT_SUPABASE.md ← Deployment guide
└── README.md                     ← This file
```

---

## ✅ Checklist

Local Development:
- [ ] Node.js 20+ installed
- [ ] Supabase project created
- [ ] `supabase-schema.sql` executed
- [ ] Backend `.env` configured
- [ ] Frontend `.env.local` configured
- [ ] Dependencies installed (`npm install`)
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can sign up and log in
- [ ] Can draw shapes
- [ ] AI commands work

Deployment:
- [ ] Code pushed to GitHub
- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set
- [ ] CORS updated
- [ ] Production app tested

---

## 🆘 Getting Help

**If you're stuck:**

1. **Check the guides:**
   - SUPABASE_SETUP.md (database setup)
   - RENDER_DEPLOYMENT_SUPABASE.md (deployment)
   - This file (local development)

2. **Check browser console:**
   - Press F12
   - Look for red errors
   - Common: API key mismatch, CORS errors

3. **Check backend logs:**
   - Look at the terminal where backend is running
   - Common: Supabase connection errors, missing env vars

4. **Check Supabase dashboard:**
   - Authentication → Users (are users being created?)
   - Table Editor → board_objects (are shapes being saved?)
   - Logs (any API errors?)

---

## 🎯 Next Steps

Once you have it running:

1. **Customize**: Change colors, add features
2. **Deploy**: Follow RENDER_DEPLOYMENT_SUPABASE.md
3. **Share**: Invite others to collaborate
4. **Explore**: Try all the AI commands
5. **Extend**: Add your own features

---

**You're all set!** 🎉

This Windows guide covers everything from installation to deployment. The Supabase version is much simpler than Firebase - just 2 API keys instead of complex service accounts!

Need help? Check the troubleshooting section above or the other documentation files.

Happy whiteboarding! 🎨
