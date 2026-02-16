# Google Apps Script Setup - Complete Guide

## Overview
This guide will help you set up Google Apps Script correctly to avoid deployment issues.

---

## Step 1: Create Google Apps Script Project

1. Go to **[script.google.com](https://script.google.com)**
2. Click **Create project** (or **New project**)
3. Name it: `Expense Tracker Backend`
4. Click **Create**

---

## Step 2: Add the Code

1. In the editor, **delete all existing code**
2. Copy the complete code from `GoogleAppsScript.gs` file
3. **Paste it all** into the editor
4. Click **Save** (or Ctrl+S)

---

## Step 3: Create and Link Google Sheet

1. Open **[Google Sheets](https://sheets.google.com)**
2. Create a new spreadsheet named: `Expense Tracker`
3. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_ID]/edit
   ```

4. Go back to your Apps Script project
5. Find this line at the top:
   ```javascript
   const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID_HERE";
   ```
6. Replace `YOUR_GOOGLE_SHEET_ID_HERE` with your actual ID
7. Click **Save**

**Example:**
```javascript
const SPREADSHEET_ID = "1E_Z-hGZht5bkHOXpaIjGtyRsCE9lxlx4dFC35Nr2IR0";
```

---

## Step 4: Grant Permissions

1. In Apps Script, click **Run** at the top
2. It will ask for permissions - **Click "Review Permissions"**
3. Select your Google account
4. Click **Allow** on all permission requests
5. Wait for execution to complete

---

## Step 5: Deploy as Web App

⚠️ **This is the most critical step!**

### First Time Deployment:

1. Click **Deploy** (top right) → **New Deployment**
2. Click the **dropdown** and select **Web app**
3. Set the following:
   - **Execute as**: Your Google Account (email)
   - **Who has access**: **Anyone** ⭐ (IMPORTANT!)
4. Click **Deploy**
5. Copy the deployment URL that appears
6. Keep this URL - you'll need it

### What You'll See:
```
Deployment successful!
New URL: https://script.google.com/macros/d/SCRIPT_ID/usercallback
```

**✅ Copy this URL exactly - this is what goes in your Vercel app!**

---

## Step 6: Update Vercel App

1. Open your Vercel project code
2. Find `/api/submit.js`
3. Locate this line:
   ```javascript
   const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/d/...';
   ```
4. Replace with your new deployment URL from Step 5
5. Push to GitHub - Vercel will auto-redeploy

---

## Step 7: Test the Deployment

### Method 1: Test in Apps Script (Recommended)

1. In Apps Script, click the **Executions** tab (left sidebar)
2. You should see a green checkmark ✅ for the last execution
3. If you see ❌, click it to see the error details

### Method 2: Test with Sample Data

1. In Apps Script editor, find this function:
   ```javascript
   function testInsert() {
   ```
2. Click **Run** at the top
3. Check **Executions** - it should show green ✅
4. Go to your Google Sheet - you should see a test row added

### Method 3: Test from Your Vercel App

1. Go to: `https://expense-tracker-omega-sandy.vercel.app`
2. Hard refresh (Ctrl+Shift+R)
3. Paste an SMS:
   ```
   AED 45.75 spent at Carrefour on 15-02-2026 using Debit Card ending 1234
   ```
4. Click **Parse Message** - should show preview
5. Click **Save to Google Sheets** - should show success

---

## Troubleshooting

### Issue 1: "Deployment Error" Message

**Solution:**
1. Delete the broken deployment
2. Click **Deploy** → **New Deployment**
3. Follow Step 5 again carefully
4. Make sure "Who has access" = "Anyone"

### Issue 2: Permission Denied Error

**Solution:**
1. Go to Apps Script
2. Click **Run** at the top
3. Grant all requested permissions
4. Try deployment again

### Issue 3: Spreadsheet Not Found

**Solution:**
1. Open your Google Sheet
2. Copy the correct ID from URL
3. In Apps Script, update line 15:
   ```javascript
   const SPREADSHEET_ID = "YOUR_CORRECT_ID";
   ```
4. Save and re-deploy

### Issue 4: Getting HTML Error Instead of JSON

**Solution:**
1. Your deployment is broken
2. Delete the deployment:
   - Click **Deploy** → Find your deployment → Click **trash icon**
3. Redeploy as Web app following **Step 5**
4. Make sure settings are exactly correct

### Issue 5: Data Not Appearing in Google Sheet

**Solution:**
1. Check Google Sheet URL - is the spreadsheet name exactly `Expense Tracker`?
2. In Apps Script, run `testInsert()` function
3. Check Executions tab for errors
4. Verify SPREADSHEET_ID is correct

---

## Verification Checklist

Before testing, verify:

- [ ] SPREADSHEET_ID is correctly set in Apps Script
- [ ] Google Sheet exists and is named "Expense Tracker"
- [ ] "Who has access" is set to "Anyone"
- [ ] Deployment URL uses `/usercallback` (not `/exec`)
- [ ] API_URL in Vercel app matches deployment URL
- [ ] Code is saved in both Apps Script and Vercel
- [ ] Vercel has redeployed (check GitHub commit)

---

## Quick Reference: URLs

### Google Apps Script Deployment URL Format:
```
https://script.google.com/macros/d/[DEPLOYMENT_ID]/usercallback
```

### What Goes in Vercel (api/submit.js):
```javascript
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/d/[YOUR_ID]/usercallback';
```

### Your Vercel App URL:
```
https://expense-tracker-omega-sandy.vercel.app
```

---

## If Still Not Working

### Check Apps Script Logs:
1. Go to Apps Script project
2. Click **Executions** (left sidebar)
3. Find recent execution
4. Click on failed execution (red ❌)
5. Read the error message
6. **Share the error with me**

### Check Vercel Logs:
1. Go to Vercel dashboard
2. Click your project
3. Click **Deployments**
4. Click latest deployment
5. Click **Logs** tab
6. Look for errors starting with ❌

---

## Common Mistakes to Avoid

❌ Using the old URL with `/exec`  
✅ Use `/usercallback` instead

❌ Setting "Who has access" to "Only me"  
✅ Must be "Anyone"

❌ Forgetting to grant permissions  
✅ Click Run first and grant permissions

❌ Wrong spreadsheet ID  
✅ Copy from the URL bar of your sheet

❌ Not updating API_URL in Vercel  
✅ Update api/submit.js with new deployment URL

---

## Final Steps

1. **Complete all steps above**
2. **Hard refresh Vercel app** (Ctrl+Shift+R)
3. **Test with sample SMS**
4. **Check Google Sheet** - data should appear

If you follow this guide exactly, it will work! 🎯

**Any errors? Reply with:**
- Screenshot of the error
- Which step you're on
- What you see in Apps Script Executions tab
