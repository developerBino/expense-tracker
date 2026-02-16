# Google Apps Script Setup Guide

## Overview
This Google Apps Script backend receives transaction data from your Expense Tracker web app and stores it in a Google Sheet.

## Setup Instructions

### Step 1: Create Google Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click **Create project**
3. Name it "Expense Tracker Backend"

### Step 2: Add the Script Code
1. Replace all code in the editor with the code from `GoogleAppsScript.gs`
2. Save the project

### Step 3: Create Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet named "Expense Tracker"
3. Copy the spreadsheet ID from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`
   - Example ID: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`

### Step 4: Update Script Configuration
1. In your Apps Script project, find this line at the top:
   ```javascript
   const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID_HERE";
   ```
2. Replace `YOUR_GOOGLE_SHEET_ID_HERE` with your actual spreadsheet ID
3. Save the project

### Step 5: Deploy as Web App
1. Click **Deploy** (top right) → **New Deployment**
2. Choose **Web app** as the deployment type
3. Set:
   - **Execute as**: Your Google Account
   - **Who has access**: Anyone
4. Click **Deploy**
5. You'll get a URL like:
   ```
   https://script.google.com/macros/d/DEPLOYMENT_ID/usercallback
   ```

### Step 6: Update Web App Configuration
1. Copy the deployment URL from Step 5
2. In `app.js`, update the API_URL:
   ```javascript
   const API_URL = "https://script.google.com/macros/d/DEPLOYMENT_ID/usercallback";
   ```
3. Save the file

### Step 7: Test
1. Open your Expense Tracker web app
2. Paste a sample SMS message
3. Click "Parse Message"
4. Click "Save to Google Sheets"
5. Check your Google Sheet - transaction should appear automatically!

## Features

### Automatic Sheet Creation
- Sheet automatically creates "Transactions" sheet if it doesn't exist
- Adds proper headers and formatting
- Headers: Timestamp, Date, Amount, Currency, Type, Merchant, Card Last 4, Category, Raw Message

### Data Validation
- Validates all required fields
- Checks date format (YYYY-MM-DD)
- Verifies transaction type (Debit/Credit)
- Confirms amount is numeric

### Helper Functions (for testing)
You can run these in the Apps Script editor for debugging:
- `testInsert()` - Test inserting a transaction
- `getCurrentMonthSummary()` - Get current month totals
- `resetSheet()` - Clear all data

### Monthly Summary Function
The `getMonthlySummary(year, month)` function calculates:
- Total Debit transactions
- Total Credit transactions
- Net Total
- Transaction count

## Troubleshooting

### "Deployment ID not found"
- Make sure you deployed the script (Deploy > New Deployment)
- Copy the deployment URL, not the script ID

### "Sheet not found"
- Verify SPREADSHEET_ID is correct
- Make sure you have edit access to the Google Sheet

### "Permission denied"
- Check that "Who has access" is set to "Anyone" in deployment
- You may need to re-deploy

### Transactions not appearing
1. Check browser console for errors (F12)
2. Check Apps Script Execution log (Apps Script > Executions)
3. Verify API_URL is correct in app.js

## Debugging Guide

### Frontend Debugging (Browser Console)
1. Open your web app in browser
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Paste an SMS and click "Parse Message"
5. Look for messages:
   - 🔍 `Parsing SMS:` - Shows input message
   - ✅ `Parsed successfully:` - Shows extracted data
   - ❌ `Parsing error:` - Parsing failed
   - 📤 `Sending to Google Sheets:` - Data being sent
   - 📡 `API URL:` - The endpoint being called
   - 📊 `Response Status:` - HTTP status code
   - ✅ `Server Response:` - Response from backend

### Backend Debugging (Apps Script Logs)
1. Go to your Apps Script project at [script.google.com](https://script.google.com)
2. Click **Executions** (left sidebar)
3. Find your most recent execution
4. Click on it to see detailed logs:
   - 📨 `Incoming request received` - Request arrived
   - ✅ `Parsed payload:` - Data received from web app
   - 🔍 `Validation result:` - Data validation check
   - 📝 `Initializing sheet...` - Starting sheet setup
   - ✅ `Sheet initialized:` - Sheet ready
   - 📋 `Row data prepared:` - Data formatted for sheet
   - ✅ `Row appended to sheet` - Data added successfully
   - ❌ Errors will show what went wrong

### Common Issues & Solutions

**Issue: "Sheet not found" error**
- ❌ SPREADSHEET_ID in GoogleAppsScript.gs is wrong
- 🔧 **Fix:** Check the Apps Script logs for "Error: Sheet not found"
- 🔧 Verify your SPREADSHEET_ID by copying from the sheet URL

**Issue: No data appears in Google Sheet**
- Check Apps Script Execution logs
- Look for "Error" entries at the bottom
- Verify "Transactions" sheet exists in your Google Sheet
- Check you have edit permissions

**Issue: "CORS" or "Network" error**
- ❌ Deployment URL is incorrect in app.js
- 🔧 **Fix:** Get the correct URL from Apps Script Deploy button
- 🔧 Make sure "Who has access" = "Anyone"

**Issue: SMS not parsing**
- Check browser console logs
- Look for ❌ "Parsing error" message
- Verify SMS format includes amount, date, and type keywords
- Test with example: `AED 45.75 spent at Carrefour on 15-02-2026 using Debit Card ending 1234`

### Testing Tips
1. Use the exact SMS format from the examples
2. Check console after each action (Parse, Save, etc.)
3. Look for message prefixes:
   - ✅ = Success
   - ❌ = Error
   - 📤📡📊 = Network activity
   - 🔍📝📋 = Data processing

## Security Notes
- This deployment URL is public (anyone with the URL can submit data)
- For production, add authorization checks in the `doPost()` function
- Consider adding rate limiting or validation tokens

## Updating the Script
If you make changes to GoogleAppsScript.gs:
1. Update the code in script.google.com
2. Save the project
3. No need to re-deploy - changes take effect immediately

