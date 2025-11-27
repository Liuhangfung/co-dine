# 🚂 Railway Deployment Guide - Co-Dine (Healthy Recipe Manager)

This guide will help you deploy your Healthy Recipe Manager app to Railway in just a few minutes.

## Why Railway?

✅ **Zero code changes needed** - your app works as-is  
✅ **Playwright supported** - web scraping works perfectly  
✅ **Easy setup** - literally 3 clicks  
✅ **Free $5/month credit** - enough for small teams  
✅ **Auto-deployments** - push to GitHub = auto deploy  
✅ **Built-in monitoring** - logs, metrics, all in one place  

---

## 📋 Prerequisites

- ✅ Code pushed to GitHub: https://github.com/Liuhangfung/co-dine.git
- ✅ Supabase database set up
- ✅ Environment variable values ready

---

## 🚀 Step-by-Step Deployment

### Step 1: Create Railway Account

1. Go to https://railway.app
2. Click **"Login"** or **"Start a New Project"**
3. Sign up with your GitHub account
4. Authorize Railway to access your repositories

⏱️ Time: 1 minute

---

### Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose **`Liuhangfung/co-dine`** from the list
4. Railway will automatically detect your Node.js app!

⏱️ Time: 30 seconds

---

### Step 3: Add Environment Variables

Click on your deployed service → **Variables** tab → Add these:

#### Required Variables:

```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Authentication
JWT_SECRET=your-random-secret-key-here

# App Configuration
VITE_APP_ID=healthy-recipe-manager
NODE_ENV=production

# AI Services (Required for AI features)
BUILT_IN_FORGE_API_URL=https://your-forge-api-url.com
BUILT_IN_FORGE_API_KEY=your-forge-api-key-here
```

#### Optional Variables (if using):

```bash
# OAuth (if enabled)
OAUTH_SERVER_URL=https://your-oauth-server.com
OWNER_OPEN_ID=your-owner-openid

# AWS S3 (for image uploads)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

**Important Notes:**
- For Railway, use port **5432** (direct connection), NOT 6543
- Railway supports long-running servers, no connection pooler needed
- Generate JWT_SECRET: `openssl rand -base64 32` or use any random 32+ character string

⏱️ Time: 2-3 minutes

---

### Step 4: Configure Build Settings (Auto-detected)

Railway automatically detects:
- **Build Command**: `pnpm install && pnpm run build`
- **Start Command**: `pnpm start`
- **Port**: Automatically from your app (3000)

No manual configuration needed! 🎉

---

### Step 5: Deploy!

1. Click **"Deploy"** (or it starts automatically)
2. Watch the build logs in real-time
3. Wait 3-5 minutes for first deployment
4. Railway will give you a public URL like: `https://co-dine-production.up.railway.app`

⏱️ Time: 3-5 minutes

---

## ✅ Verify Deployment

### Check these:

1. **Build succeeded** - Check logs for "Build succeeded"
2. **Database connected** - Look for: `[Database] ✅ Connected to Supabase PostgreSQL`
3. **Server running** - Look for: `Server running on http://...`
4. **Open your app** - Click the public URL Railway provides

### Test your app:

- Visit: `https://your-app.up.railway.app/`
- Try creating a recipe
- Test AI features
- Check database persistence

---

## 🔄 Continuous Deployment

Now every time you push to GitHub:

```bash
git add .
git commit -m "Your changes"
git push
```

Railway **automatically**:
1. Detects the push
2. Builds your app
3. Deploys if successful
4. Keeps old version if build fails

---

## 📊 Monitoring & Logs

### View Logs:
1. Go to Railway dashboard
2. Click on your service
3. Click **"Deployments"** → Select deployment
4. View real-time logs

### Monitor Usage:
- Dashboard shows CPU, Memory, Network usage
- Free $5/month credit usage tracker
- Set up alerts for high usage

---

## 🎯 Custom Domain (Optional)

Want to use your own domain? (e.g., `codine.yourdomain.com`)

1. Go to your service → **Settings**
2. Click **"Generate Domain"** (Railway provides free subdomain)
3. Or add **Custom Domain**:
   - Enter your domain
   - Add CNAME record to your DNS:
     ```
     CNAME: your-subdomain → your-app.up.railway.app
     ```
4. Railway automatically provisions SSL certificate

⏱️ Time: 2 minutes (DNS propagation: 5-60 minutes)

---

## 💰 Pricing

**Hobby Plan (Free):**
- $5/month credit (free forever)
- Good for ~500MB RAM apps
- Unlimited projects
- Perfect for small teams

**Your app typically uses:**
- ~200-400MB RAM
- ~$3-7/month
- Free tier covers it! 🎉

**Pro Plan ($20/month):**
- $20 included usage + $0.000231/GB-hour
- Priority builds
- Custom domains
- Team features

---

## 🐛 Troubleshooting

### Issue: "Build Failed"

**Check:**
1. Environment variables are set correctly
2. `DATABASE_URL` is valid
3. Check build logs for specific errors

**Fix:**
```bash
# Rebuild locally to test
pnpm install
pnpm run build
```

---

### Issue: "Database connection failed"

**Check:**
1. `DATABASE_URL` is correct (port 5432 for Railway)
2. Supabase project is active
3. IP is whitelisted (Railway IPs change, use Supabase connection pooling)

**Fix:**
- Use Supabase's connection pooler if needed (port 6543)
- Check Supabase dashboard for connection logs

---

### Issue: "App crashes on startup"

**Check:**
1. Start command is correct: `pnpm start`
2. All required environment variables are set
3. Check deployment logs for error messages

**Fix:**
```bash
# Test locally
pnpm start
# If works locally, check Railway environment variables
```

---

### Issue: "Port binding error"

**Fix:**
Railway automatically assigns PORT via environment variable.
Your app already handles this in `server/_core/index.ts`:
```typescript
const preferredPort = parseInt(process.env.PORT || "3000");
```
No changes needed!

---

## 🔐 Security Best Practices

✅ **Use environment variables** - Never commit secrets  
✅ **Rotate secrets regularly** - Especially JWT_SECRET  
✅ **Use HTTPS** - Railway provides it automatically  
✅ **Monitor logs** - Check for unauthorized access  
✅ **Separate environments** - Use different Railway projects for dev/prod  
✅ **Backup database** - Regular Supabase backups  

---

## 🚀 Production Checklist

Before sharing with teammates:

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Test all major features
- [ ] Check error handling
- [ ] Set up error tracking (optional: Sentry)
- [ ] Configure custom domain (optional)
- [ ] Test on mobile devices
- [ ] Share URL with team! 🎉

---

## 📚 Useful Railway Commands

Railway provides a CLI for advanced users:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Run commands in Railway environment
railway run node scripts/seed-data.js
```

---

## 🤝 Sharing with Teammates

### Share Access:

1. Railway Dashboard → Your Project
2. Click **"Settings"** → **"Team"**
3. Invite team members by email
4. Set permissions (Viewer, Developer, Admin)

### Share App URL:

Just send your team the Railway URL:
```
https://your-app.up.railway.app
```

They can use it immediately! No setup needed on their end.

---

## 🎯 Next Steps

After successful deployment:

1. ✅ **Test thoroughly** - All features work?
2. ✅ **Monitor usage** - Check Railway dashboard
3. ✅ **Set up alerts** - High usage notifications
4. ✅ **Plan scaling** - As team grows
5. ✅ **Collect feedback** - From teammates

---

## 🆘 Need Help?

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **This project**: https://github.com/Liuhangfung/co-dine

---

## 🎉 Success!

Your app is now:
- ✅ Deployed to Railway
- ✅ Accessible via public URL
- ✅ Auto-deploys on push
- ✅ Ready to share with team!

**Your deployment URL:**
```
https://your-app-name.up.railway.app
```

Share it with your teammates and start cooking! 👨‍🍳👩‍🍳

---

**Last Updated**: November 2025  
**Repository**: https://github.com/Liuhangfung/co-dine  
**Estimated Setup Time**: 10 minutes  

