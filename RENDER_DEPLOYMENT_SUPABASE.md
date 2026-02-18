# 🚀 Deploy to Render.com with Supabase

**Ultra-simplified:** Just 5 environment variables, no Redis, no Firebase complexity!

---

## What You'll Deploy

- **Backend**: Render.com (free tier)
- **Frontend**: Your choice (Vercel/Netlify/Render static)
- **Database**: Supabase (free tier)

**Total cost: $0/month**

---

## Prerequisites

- ✅ Supabase project set up (see SUPABASE_SETUP.md)
- ✅ GitHub account
- ✅ Anthropic API key
- ✅ Your code pushed to GitHub

---

## Step 1: Deploy Backend to Render (5 min)

### Create Web Service:

1. Go to **https://render.com** and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Settings:
   - **Name**: `ai-whiteboard-backend`
   - **Region**: Oregon (or closest)
   - **Root Directory**: `backend`
   - **Environment**: **Docker**
   - **Plan**: **Free**

### Set Environment Variables:

Click **"Advanced"** → **"Add Environment Variable"** for each:

| Key | Value | Where to Get It |
|-----|-------|-----------------|
| `NODE_ENV` | `production` | (literal) |
| `PORT` | `8080` | (literal) |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Supabase → Settings → API → service_role |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Your frontend URL (update later if needed) |

**Click "Create Web Service"**

Wait 5-7 minutes for deployment.

### Test:

Open: `https://ai-whiteboard-backend.onrender.com/health`

Should see:
```json
{"status":"healthy","database":"Supabase PostgreSQL"}
```

✅ **Backend deployed!**

---

## Step 2: Deploy Frontend

### Option A: Vercel (Easiest)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Follow prompts
# Build command: npm run build
# Output directory: dist
```

Set environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL` (your Render backend URL)

### Option B: Netlify

```bash
cd frontend
npm run build

# Drag and drop the `dist` folder to Netlify
# Or connect GitHub repo and set:
# Build command: npm run build
# Publish directory: dist
```

Add environment variables in Netlify dashboard.

### Option C: Render Static Site

1. Render → **"New +"** → **"Static Site"**
2. Connect repo
3. Root Directory: `frontend`
4. Build Command: `npm run build`
5. Publish Directory: `dist`
6. Add environment variables

---

## Step 3: Update CORS (2 min)

Once frontend is deployed:

1. Copy your frontend URL
2. Render → your backend service → **Environment**
3. Update `ALLOWED_ORIGINS` to your frontend URL
4. Click **"Save"** → Render redeploys (~2 min)

---

## Step 4: Configure Supabase Redirects (1 min)

If using Google OAuth:

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://your-frontend.vercel.app`
3. **Redirect URLs**: Add `https://your-frontend.vercel.app/**`
4. Click **"Save"**

---

## ✅ Test Everything

1. Open your frontend URL
2. Click **"Sign Up"** → create account
3. Draw shapes
4. Click **✨ AI** → try `"Create 5 circles"`
5. Open second tab → verify real-time sync

**All working?** 🎉 You're live!

---

## 🎯 What Makes This Simple

### With Firebase (Before):
- Download service account JSON
- 3 separate Firebase credentials
- Firebase Hosting setup
- Complex auth flow

### With Supabase (Now):
- ✅ Just 2 Supabase values (URL + anon key)
- ✅ Plus 1 service role key for backend
- ✅ That's it!

**Total environment variables: 5** (was 7+ with Firebase)

---

## 🐛 Troubleshooting

### "Supabase: session not found"
→ Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match on frontend

### "CORS error"
→ Update `ALLOWED_ORIGINS` on Render backend

### "Database error"
→ Check `SUPABASE_SERVICE_ROLE_KEY` is set on backend
→ Verify database schema was run (see SUPABASE_SETUP.md)

### "Can't sign up"
→ Check Supabase → Authentication → Providers → Email is enabled
→ Check Supabase Logs for details

---

## 💰 Cost Breakdown

**Render Free Tier:**
- Backend hosting
- Sleeps after 15 min (cold start ~30s)

**Supabase Free Tier:**
- 500MB database
- 50K monthly active users
- Unlimited API requests

**Vercel/Netlify Free Tier:**
- Frontend hosting
- 100GB bandwidth
- Automatic HTTPS

**Total: $0/month** for hobby projects

---

## 📊 Monitor Your App

### Render Dashboard:
- Logs (real-time)
- Metrics (requests, errors)
- Deployments

### Supabase Dashboard:
- Table Editor (see all data)
- Logs (API requests)
- Database (usage stats)

### Frontend Platform:
- Analytics
- Logs
- Bandwidth usage

---

## 🚀 Scaling

**When you outgrow free tier:**

1. **Render Starter** ($7/mo) - eliminates cold starts
2. **Supabase Pro** ($25/mo) - 8GB database, more users
3. **Vercel Pro** ($20/mo) - more bandwidth

Most apps stay on free tier for a long time!

---

## ✨ Next Steps

- Add custom domain
- Enable more auth providers (GitHub, Twitter)
- Set up database backups
- Add monitoring alerts
- Invite collaborators

---

**That's it!** Your AI Whiteboard is live with Supabase. Much simpler than Firebase! 🎉

Questions? See:
- SUPABASE_SETUP.md (database setup)
- RENDER_TROUBLESHOOTING.md (common errors)
