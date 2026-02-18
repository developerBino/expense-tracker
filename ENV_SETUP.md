# CashFlow - Environment Setup Guide

## 🔐 Environment Variables

This project uses environment variables to secure all sensitive data including Google Apps Script URL and authentication credentials.

### Local Development Setup

1. **Create `.env` file** in the project root
2. **Add your values:**

```bash
# Google Apps Script Deployment URL
# Get this from: script.google.com → Deploy → Copy the execution URL
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec

# Authentication Codes (JSON format)
# Format: {"code": "username"}
AUTH_CODES={"5515":"Bino","2131":"Merlin"}
```

3. **Never commit** `.env` to git (already in `.gitignore`)

### Vercel Deployment Setup

Follow these steps to add environment variables to your Vercel project:

1. **Go to** [Vercel Dashboard](https://vercel.com/dashboard)
2. **Select** your "expense-tracker" project
3. **Click "Settings"** tab
4. **Go to "Environment Variables"** section
5. **Add variables:**

   **Variable 1: Google Apps Script URL**
   - **Name:** `GOOGLE_APPS_SCRIPT_URL`
   - **Value:** Your Google Apps Script deployment URL (the full URL from when you deployed your Apps Script)
   - **Select Environments:** Production, Preview, Development
   - **Click "Save"**

   **Variable 2: Authentication Codes**
   - **Name:** `AUTH_CODES`
   - **Value:** `{"5515":"Bino","2131":"Merlin"}` (modify usernames/codes as needed)
   - **Select Environments:** Production, Preview, Development
   - **Click "Save"**

6. **Your Vercel functions** will automatically use these variables

### Why This Matters

❌ **Before (Insecure):**
- Credentials hardcoded in code
- Visible in GitHub repository
- Anyone with access to repo could hijack your system or gain unauthorized access

✅ **After (Secure):**
- All credentials stored in Vercel's secure environment
- Not exposed in code repositories
- Only accessible during deployment
- Can be rotated without changing code
- Each environment can have different credentials

### Testing Locally

1. Ensure `.env` file exists with both `GOOGLE_APPS_SCRIPT_URL` and `AUTH_CODES`
2. Run your local development server
3. API calls will use the values from `.env`
4. Login credentials will be loaded from `/api/auth-config` endpoint

### Troubleshooting

**If you get "Google Apps Script is unavailable" error:**
1. Check `.env` has correct `GOOGLE_APPS_SCRIPT_URL`
2. Verify URL is copied exactly (check for extra spaces)
3. Make sure you deployed the latest version in Google Apps Script
4. Test with Postman using the URL directly

**If login shows "Contact administrator" message:**
1. Check that `AUTH_CODES` is set in Vercel Environment Variables (JSON format)
2. Verify the JSON format is correct: `{"code":"username"}`
3. Redeploy: `git push origin main` or use Vercel dashboard "Redeploy" button

**If Vercel deployment fails:**
1. Check that both variables are set in Vercel Environment Variables
2. Verify JSON format for `AUTH_CODES` is valid
3. Check Vercel deployment logs for errors

