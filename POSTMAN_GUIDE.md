# Postman Collection - Expense Tracker Testing Guide

## How to Import the Collection

1. **Open Postman** (download from https://www.postman.com/downloads/ if needed)
2. **Click "Import"** (top left button)
3. **Select "Upload Files"** tab
4. **Choose** `Postman_Collection.json` from this project
5. **Collections** → You'll see "Expense Tracker - Google Apps Script" collection

## Available Requests

### 1. **GET - Fetch All Transactions**
- **Method:** GET
- **URL:** Direct to Google Apps Script
- **Purpose:** Retrieve all transactions from the Google Sheet
- **Expected Response:** 
```json
{
  "success": true,
  "data": [...],
  "count": 17,
  "timestamp": "2026-02-18T19:17:22Z"
}
```

### 2. **POST - Save Transaction**
- **Method:** POST
- **Body:** JSON with transaction data
- **Required Fields:** `date`, `amount`, `currency`, `type`
- **Example:** Carrefour groceries purchase
- **Expected Response:**
```json
{
  "success": true,
  "message": "Transaction saved successfully",
  "timestamp": "2026-02-18T19:17:22Z"
}
```

### 3. **POST - Save Transaction (Debit from SMS)**
- **Method:** POST
- **Body:** Example from your SMS parsing (United Transport)
- **Purpose:** Test with actual SMS-parsed data
- **Use:** Verify SMS parsing and Google Sheets integration

### 4. **POST - Save Transaction (Credit)**
- **Method:** POST
- **Body:** Example credit transaction (salary deposit)
- **Purpose:** Test credit transaction handling
- **Use:** Verify both debit and credit types work

## Testing Steps

1. **Test GET First**
   - Click "GET - Fetch All Transactions"
   - Click "Send"
   - Check response in "Body" tab
   - Should show all 17 transactions if Google Apps Script is working

2. **Test POST (If GET succeeds)**
   - Click "POST - Save Transaction" 
   - Click "Send"
   - Check response - should show `"success": true`
   - Go to Google Sheet to verify new row was added

3. **Check Google Apps Script Logs**
   - Open [script.google.com](https://script.google.com)
   - Your "Expense Tracker" project → Executions
   - Review logs for each request to debug issues

## Troubleshooting

### If GET returns empty data array
- Problem: Sheet exists but no transactions
- Solution: Check if "Transactions" sheet has data

### If GET fails with "Sheet not found" error
- Problem: Sheet name mismatch
- Solution: Verify sheet is named exactly "Transactions"

### If POST fails with validation error
- Problem: Missing required fields
- Solution: Ensure `date` is YYYY-MM-DD format, `amount` is number, `type` is "Debit" or "Credit"

### If both fail
- Problem: Google Apps Script deployment URL may be outdated
- Solution: Update the URL in each request:
  1. Get new URL from [script.google.com](https://script.google.com) → Deploy → New Deployment
  2. Replace URL in all Postman requests

## Google Apps Script Execution Logs

To see detailed logs of what's happening on the backend:

1. Go to [script.google.com](https://script.google.com)
2. Open your "Expense Tracker" project
3. Click **Executions** (left sidebar)
4. See all API calls with timestamps and log outputs
5. Click any execution to see full logs

This will show:
- Whether data was retrieved from sheet
- Column mapping results
- Any errors during processing
- Timestamp of each request

## Notes

- Make sure your Google Apps Script is deployed (not just saved)
- Each POST request creates a new row with current timestamp
- GET request shows all transactions including recently added ones
- Check browser DevTools Console in your app for client-side logs too
