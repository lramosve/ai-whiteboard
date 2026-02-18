# 🎨 AI Whiteboard with Supabase

Production-ready collaborative whiteboard powered by **Supabase** (PostgreSQL + Auth), real-time WebSockets, and Claude AI.

---

## ✨ Why Supabase?

- ✅ **PostgreSQL** - Industry-standard SQL database
- ✅ **Simple Auth** - Just 2 API keys (no JSON files!)
- ✅ **Open Source** - Self-hostable, no vendor lock-in
- ✅ **Built-in Tools** - Database UI, SQL editor, real-time logs
- ✅ **Free Tier** - 500MB database, 50K users, unlimited API requests

---

## 🚀 Quick Start

### 1. Set Up Supabase (5 min)

1. Create project at **https://supabase.com**
2. Run `supabase-schema.sql` in SQL Editor
3. Copy Project URL + API keys

**→ See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed guide**

### 2. Local Development

```powershell
# Windows PowerShell
.\setup-supabase.ps1    # Automated wizard!

# Or manual:
cd backend
npm install
# Create .env with Supabase keys
npm run dev

cd ../frontend
npm install
# Create .env.local with Supabase keys
npm run dev
```

**→ See [WINDOWS_SETUP_SUPABASE.md](./WINDOWS_SETUP_SUPABASE.md) for Windows guide**

### 3. Deploy (10 min)

- **Backend**: Render.com (free)
- **Frontend**: Vercel/Netlify (free)

**→ See [RENDER_DEPLOYMENT_SUPABASE.md](./RENDER_DEPLOYMENT_SUPABASE.md)**

---

## 🎯 Features

- 🔐 **Authentication**: Email/password + Google OAuth
- 🎨 **Real-time Collaboration**: Multiple users, live cursors
- 🤖 **AI Commands**: Natural language → shapes/diagrams
- 👥 **Permissions**: Owner, admin, editor, viewer roles
- 💾 **PostgreSQL Database**: Full SQL power
- ⚡ **No Redis Required**: In-memory caching

---

## 📊 Environment Variables

### Backend (.env)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_BACKEND_URL=http://localhost:8080
```

---

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- Supabase (PostgreSQL + Auth)
- Socket.io (real-time)
- Claude Sonnet 4 (AI)

**Frontend:**
- React 18 + Vite
- Konva.js (canvas)
- Supabase Client
- Tailwind CSS

---

## 🎨 AI Command Examples

```
"Create 5 blue circles in a row"
"Draw a flowchart with 4 steps"
"Make a 3x3 grid of squares"
"Create a timeline from 2020 to 2024"
```

**→ See [AI_EXAMPLES.md](./AI_EXAMPLES.md) for 50+ examples**

---

## 📁 Project Structure

```
ai-whiteboard/
├── backend/
│   ├── src/
│   │   ├── config/supabase.js      ← Database connection
│   │   ├── routes/auth.js          ← Auth endpoints
│   │   ├── routes/boards.js        ← Board CRUD
│   │   ├── services/aiAgent.js     ← Claude integration
│   │   └── websocket/socketHandler.js
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── services/supabase.js    ← Supabase client
│   │   ├── contexts/AuthContext.jsx
│   │   └── components/
│   └── .env.local
├── supabase-schema.sql             ← Run this in Supabase
└── setup-supabase.ps1              ← Windows setup wizard
```

---

## 💰 Cost

**Free Tier:**
- Supabase: 500MB DB, 50K users
- Render: Free hosting (sleeps after 15min)
- Vercel: Free hosting

**Total: $0/month** for development

---

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Database & auth setup |
| [WINDOWS_SETUP_SUPABASE.md](./WINDOWS_SETUP_SUPABASE.md) | Windows development guide |
| [RENDER_DEPLOYMENT_SUPABASE.md](./RENDER_DEPLOYMENT_SUPABASE.md) | Deploy to production |
| [AI_EXAMPLES.md](./AI_EXAMPLES.md) | AI command examples |

---

## 🔒 Security

- Row Level Security (RLS) in PostgreSQL
- JWT token authentication
- CORS protection
- Rate limiting
- Secure environment variables

---

## 🐛 Troubleshooting

**Database errors?**
→ Run `supabase-schema.sql` in Supabase SQL Editor

**Auth errors?**
→ Check Supabase URL and anon key match

**CORS errors?**
→ Update `ALLOWED_ORIGINS` on backend

**→ See [RENDER_TROUBLESHOOTING.md](./RENDER_TROUBLESHOOTING.md)**

---

## 🎯 Quick Commands

```powershell
# Start development (Windows)
.\setup-supabase.ps1        # First time setup
.\start-backend.bat         # Start backend
.\start-frontend.bat        # Start frontend

# Deploy
git push origin main        # Render auto-deploys
vercel                      # Deploy frontend
```

---

## ✅ What's Different from Firebase?

| Feature | Firebase | Supabase |
|---------|----------|----------|
| Database | Firestore (NoSQL) | **PostgreSQL** ✅ |
| Auth Setup | Service account JSON | **2 API keys** ✅ |
| Env Vars | 7+ variables | **5 variables** ✅ |
| Open Source | No | **Yes** ✅ |
| SQL Queries | Limited | **Full SQL** ✅ |

---

**Built with Supabase 🟢 | Powered by Claude Sonnet 4 🤖 | Ready to Deploy 🚀**

Questions? Check the documentation files or visit https://supabase.com/docs
