# 🚀 Supabase Setup Guide

Complete guide to setting up Supabase for the AI Whiteboard.

**Why Supabase over Firebase?**
- ✅ Open source (can self-host)
- ✅ PostgreSQL (industry standard, powerful queries)
- ✅ Simpler authentication (no service account JSON!)
- ✅ Built-in database UI
- ✅ Generous free tier (500MB database, 50K monthly active users)
- ✅ Real-time subscriptions included
- ✅ Row Level Security (RLS) for fine-grained access control

---

## Step 1: Create Supabase Project (5 min)

1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign in with GitHub (recommended)
4. Click **"New project"**
5. Fill in:
   - **Name**: `ai-whiteboard`
   - **Database Password**: Generate strong password (save this!)
   - **Region**: Choose closest to you
   - **Plan**: Free
6. Click **"Create new project"**

Wait ~2 minutes for project to provision.

---

## Step 2: Run Database Schema (2 min)

1. In your Supabase project, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase-schema.sql` from this project
4. Copy ALL the contents
5. Paste into the SQL Editor
6. Click **"Run"** (bottom right)

You should see:
```
Database schema created successfully!
Tables: boards, board_objects, board_collaborators, ai_commands, users
RLS policies enabled for all tables
```

✅ **Database is ready!**

---

## Step 3: Enable Authentication Providers (2 min)

### Email/Password (Required):

1. Click **"Authentication"** (left sidebar)
2. Click **"Providers"**
3. **Email** should already be enabled ✅

### Google OAuth (Optional but Recommended):

1. In **Providers**, find **"Google"**
2. Toggle **"Enable"**
3. You need Google OAuth credentials:
   - Go to https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI:
     ```
     https://your-project-ref.supabase.co/auth/v1/callback
     ```
     (Replace `your-project-ref` with your actual Supabase project reference)
   - Copy Client ID and Client Secret
4. Paste Client ID and Client Secret in Supabase
5. Click **"Save"**

---

## Step 4: Get Your API Keys (1 min)

1. Click **"Settings"** (gear icon, bottom left)
2. Click **"API"**
3. You'll see:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Project API keys**:
     - `anon` key (public) - safe to use in frontend
     - `service_role` key (secret) - for backend only

**Copy these three values** - you'll need them next.

---

## Step 5: Configure Backend Environment

Create `backend/.env`:

```bash
NODE_ENV=development
PORT=8080

# Supabase (from Step 4)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

---

## Step 6: Configure Frontend Environment

Create `frontend/.env.local`:

```bash
# Supabase (same URL and anon key from backend)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Backend
VITE_BACKEND_URL=http://localhost:8080
```

---

## Step 7: Test Locally (5 min)

Install dependencies:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

Start services:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open: **http://localhost:3000**

### Test Authentication:

1. Click **"Sign Up"**
2. Enter email/password
3. Check Supabase dashboard → **Authentication** → **Users**
4. You should see your new user! ✅

### Test Database:

1. Draw some shapes
2. In Supabase dashboard → **Table Editor** → Select `board_objects`
3. You should see your shapes! ✅

---

## Step 8: Deploy to Render (10 min)

See `RENDER_DEPLOYMENT_SUPABASE.md` for complete deployment guide.

**Quick version:**

1. Push to GitHub
2. Create Render Web Service
3. Set environment variables (only 5 needed!):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `ALLOWED_ORIGINS`

---

## 🔒 Security Features

### Row Level Security (RLS)

All tables have RLS enabled with these policies:

**Boards:**
- ✅ Anyone can view public boards
- ✅ Users can view/edit their own boards
- ✅ Collaborators can view boards they're added to

**Objects:**
- ✅ Anyone can view objects on public boards
- ✅ Only editors can create/update/delete objects

**AI Commands:**
- ✅ Logged to database for audit trail
- ✅ Only accessible board members can view

### API Keys

- **Anon key**: Safe for frontend, respects RLS
- **Service role key**: Backend only, bypasses RLS

Never expose service role key in frontend!

---

## 📊 Supabase Dashboard Features

### Table Editor
- View all your data in real-time
- Edit rows directly
- See relationships

### SQL Editor
- Run custom queries
- Create views
- Modify schema

### Authentication
- See all users
- Manually verify emails
- Delete users

### Logs
- API request logs
- Slow query logs
- Error logs

### Database
- Backups
- Connection pooling
- Extensions

---

## 🆚 Supabase vs Firebase

| Feature | Supabase | Firebase |
|---------|----------|----------|
| **Database** | PostgreSQL | Firestore (NoSQL) |
| **Open Source** | ✅ Yes | ❌ No |
| **Self-hostable** | ✅ Yes | ❌ No |
| **Auth Setup** | 2 env vars | Service account JSON |
| **Real-time** | ✅ Built-in | ✅ Built-in |
| **SQL Queries** | ✅ Native | ❌ Limited |
| **Free Tier DB** | 500MB | 1GB |
| **Free Tier Users** | 50K MAU | Unlimited |
| **RLS** | ✅ Native | 🟡 Security rules |

---

## 💰 Pricing

### Free Tier (Perfect for Development)
- 500MB database
- 50K monthly active users
- 2GB file storage
- 50GB bandwidth
- Unlimited API requests

**Most personal projects fit in free tier!**

### Pro Tier ($25/month when needed)
- 8GB database
- 100K monthly active users
- 100GB file storage
- 250GB bandwidth
- Daily backups

---

## 🐛 Troubleshooting

### "relation does not exist"
→ Run the SQL schema (`supabase-schema.sql`)

### "JWT expired" or auth errors
→ Check your anon key is correct
→ Make sure SUPABASE_URL matches

### "permission denied for table"
→ RLS policies blocking access
→ Check you're logged in
→ Use service_role key on backend

### Can't sign up users
→ Check email provider is enabled
→ Check email doesn't already exist
→ Look at Supabase Logs for details

### Real-time not working
→ Check RLS policies allow SELECT
→ Verify subscription channel name matches

---

## 📚 Useful Links

- **Supabase Dashboard**: https://app.supabase.com
- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Row Level Security**: https://supabase.com/docs/guides/auth/row-level-security

---

## ✅ Setup Complete!

You should now have:
- ✅ Supabase project created
- ✅ Database schema deployed
- ✅ Authentication enabled
- ✅ API keys configured
- ✅ Local development working
- ✅ Ready to deploy!

**Next steps:**
- Deploy to Render (see RENDER_DEPLOYMENT_SUPABASE.md)
- Customize the database schema
- Add more auth providers
- Monitor usage in Supabase dashboard

Happy building! 🎨
