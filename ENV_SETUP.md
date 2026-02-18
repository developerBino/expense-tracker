# CashFlow - Environment Setup Guide

## 🔐 Environment Variables

This project uses environment variables to secure sensitive data like the Google Apps Script URL.

### Local Development Setup

1. **Create `.env.local` file** in the project root
2. **Add your values:**

```bash
# Google Apps Script URL - Get this from your Apps Script deployment
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

# Frontend API endpoint (for local testing)
VITE_API_ENDPOINT=http://localhost:3000/api/submit
```

3. **Never commit** `.env.local` to git (already in `.gitignore`)

### Vercel Deployment Setup

Follow these steps to add environment variables to your Vercel project:

1. **Go to** [Vercel Dashboard](https://vercel.com/dashboard)
2. **Select** your "expense-tracker" project
3. **Click "Settings"** tab
4. **Go to "Environment Variables"** section
5. **Add new variable:**
   - **Name:** `GOOGLE_APPS_SCRIPT_URL`
   - **Value:** Your Google Apps Script deployment URL (the full URL from when you deployed your Apps Script)
   - **Select Environments:** Production, Preview, Development
   - **Click "Save"**

6. **Your Vercel function** will automatically use this variable

### Why This Matters

❌ **Before (Insecure):**
- Deployment URL hardcoded in code
- Visible in GitHub repository
- Anyone with access to repo could hijack your GAS endpoint

✅ **After (Secure):**
- URL stored in Vercel's secure environment
- Not exposed in code repositories
- Only accessible during deployment
- Can be rotated without changing code

### Testing Locally

1. Ensure `.env.local` file exists with `GOOGLE_APPS_SCRIPT_URL`
2. Run your local development server
3. API calls will use the URL from `.env.local`

### Troubleshooting

**If you get "Google Apps Script is unavailable" error:**
1. Check `.env.local` has correct `GOOGLE_APPS_SCRIPT_URL`
2. Verify URL is copied exactly (check for extra spaces)
3. Make sure you deployed the latest version in Google Apps Script
4. Test with Postman using the URL directly

**If Vercel deployment fails:**
1. Check that `GOOGLE_APPS_SCRIPT_URL` is set in Vercel Environment Variables
2. Redeploy: `git push origin main` or use Vercel dashboard "Redeploy" button
3. Check Vercel deployment logs for errors
