// ==========================================
// Google Apps Script - Expense Tracker Backend
// ==========================================
// 
// Setup Instructions:
// 1. Create a new Google Apps Script project at script.google.com
// 2. Replace the default code with this script
// 3. Create a new Google Sheet and note its ID
// 4. Replace SPREADSHEET_ID below with your Sheet ID
// 5. Deploy as a web app (Deploy > New Deployment > Web app)
// 6. Copy the deployment URL to your index.html file
//
// ==========================================

// Configuration
const SPREADSHEET_ID = "1E_Z-hGZht5bkHOXpaIjGtyRsCE9lxlx4dFC35Nr2IR0";
const SHEET_NAME = "Transactions";

// ==========================================
// Main Handler
// ==========================================

/**
 * Main function to handle GET requests (retrieve all transactions)
 */
function doGet(e) {
  try {
    Logger.log("📨 GET request received");
    
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();
    
    Logger.log("📊 Total rows in sheet: " + data.length);
    Logger.log("� Total columns: " + (data[0] ? data[0].length : 0));
    
    if (data.length === 0) {
      Logger.log("⚠️ Sheet is completely empty");
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*")
        .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
    }
    
    // Log first row (headers)
    Logger.log("📋 First row (headers): " + JSON.stringify(data[0]));
    
    if (data.length <= 1) {
      Logger.log("⚠️ No data rows found (only headers)");
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*")
        .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
    }
    
    // Skip header row and convert to objects
    const headers = data[0];
    Logger.log("📑 Number of headers: " + headers.length);
    Logger.log("📑 Headers: " + JSON.stringify(headers));
    
    const transactions = [];
    
    Logger.log("🔄 Processing rows (total: " + (data.length - 1) + ")");
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      Logger.log("  Row " + i + " content: " + JSON.stringify(row));
      Logger.log("  Row " + i + " first column value: '" + row[0] + "' (type: " + typeof row[0] + ")");
      
      // Skip completely empty rows (check if first column is empty)
      if (!row[0] || row[0] === "" || (typeof row[0] === 'object' && Object.keys(row[0]).length === 0)) {
        Logger.log("  ⏭️ Skipping empty row " + i);
        continue;
      }
      
      Logger.log("  📝 Processing row " + i);
      
      const transaction = {};
      
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/\s+/g, '_');
        transaction[key] = row[index];
      });
      
      transactions.push(transaction);
      Logger.log("  ✅ Row " + i + " converted: " + JSON.stringify(transaction));
    }
    
    Logger.log("✅ Total transactions found: " + transactions.length);
    
    const response = {
      success: true,
      data: transactions,
      count: transactions.length,
      timestamp: new Date().toISOString()
    };
    
    Logger.log("📤 Returning response: " + JSON.stringify(response));
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
      
  } catch (error) {
    Logger.log("Error: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString(),
      data: [],
      count: 0
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Main function to handle POST requests from the web app
 */
function doPost(e) {
  try {
    Logger.log("📨 Incoming request received");
    Logger.log("Request content: " + e.postData.contents);
    
    // Parse incoming JSON data
    const payload = JSON.parse(e.postData.contents);
    Logger.log("✅ Parsed payload: " + JSON.stringify(payload));

    // Validate data
    const validation = validateTransaction(payload);
    Logger.log("🔍 Validation result: " + JSON.stringify(validation));
    
    if (!validation.valid) {
      Logger.log("❌ Validation failed: " + validation.error);
      return buildResponse(false, validation.error);
    }

    // Insert data into Google Sheet
    const result = insertTransaction(payload);
    Logger.log("📊 Insert result: " + JSON.stringify(result));
    
    if (result.success) {
      Logger.log("✅ Transaction saved successfully");
      return buildResponse(true, "Transaction saved successfully");
    } else {
      Logger.log("❌ Insert failed: " + result.error);
      return buildResponse(false, result.error);
    }

  } catch (error) {
    Logger.log("❌ Error in doPost: " + error.toString());
    Logger.log("Stack: " + error.stack);
    return buildResponse(false, "Server error: " + error.toString());
  }
}

/**
 * Handle CORS preflight requests
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ==========================================
// Validation
// ==========================================

/**
 * Validate transaction data structure
 */
function validateTransaction(data) {
  // Check required fields
  const requiredFields = ['date', 'amount', 'currency', 'type'];
  
  for (let field of requiredFields) {
    if (!data[field]) {
      return {
        valid: false,
        error: `Missing required field: ${field}`
      };
    }
  }

  // Validate amount is a number
  if (isNaN(parseFloat(data.amount))) {
    return {
      valid: false,
      error: "Amount must be a valid number"
    };
  }

  // Validate transaction type
  if (!['Debit', 'Credit'].includes(data.type)) {
    return {
      valid: false,
      error: "Transaction type must be 'Debit' or 'Credit'"
    };
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    return {
      valid: false,
      error: "Date must be in YYYY-MM-DD format"
    };
  }

  return { valid: true };
}

// ==========================================
// Sheet Operations
// ==========================================

/**
 * Initialize sheet if it doesn't exist
 */
function initializeSheet() {
  Logger.log("🔍 Opening spreadsheet with ID: " + SPREADSHEET_ID);
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log("✅ Spreadsheet opened");
    
    let sheet = ss.getSheetByName(SHEET_NAME);

    // If sheet doesn't exist, create it
    if (!sheet) {
      Logger.log("📄 Sheet '" + SHEET_NAME + "' not found, creating new sheet...");
      sheet = ss.insertSheet(SHEET_NAME);
      Logger.log("✅ New sheet created: " + SHEET_NAME);
      
      // Add headers
      const headers = [
        "Timestamp",
        "User",
        "Date",
        "Amount",
        "Currency",
        "Type",
        "Merchant",
        "Card Last 4",
        "Category",
        "Raw Message"
      ];
      
      Logger.log("📝 Adding headers: " + JSON.stringify(headers));
      sheet.appendRow(headers);
      
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#667eea");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");
      Logger.log("✅ Headers formatted");
    } else {
      Logger.log("✅ Sheet '" + SHEET_NAME + "' already exists");
    }

    return sheet;
    
  } catch (error) {
    Logger.log("❌ Error in initializeSheet: " + error.toString());
    Logger.log("Stack: " + error.stack);
    throw error;
  }
}

/**
 * Insert transaction into Google Sheet
 */
function insertTransaction(data) {
  try {
    Logger.log("📝 Initializing sheet...");
    const sheet = initializeSheet();
    Logger.log("✅ Sheet initialized: " + sheet.getName());
    
    // Prepare row data
    const timestamp = new Date().toISOString();
    const rowData = [
      timestamp,
      data.user || "Unknown",
      data.date,
      parseFloat(data.amount),
      data.currency,
      data.type,
      data.merchant || "",
      data.card_last4 || "",
      data.category || "Other",
      data.raw || ""
    ];

    Logger.log("📋 Row data prepared: " + JSON.stringify(rowData));

    // Append row to sheet
    sheet.appendRow(rowData);
    Logger.log("✅ Row appended to sheet");

    // Auto-fit columns
    sheet.autoResizeColumns(1, rowData.length);
    Logger.log("✅ Columns auto-fitted");

    Logger.log("✅ Transaction inserted successfully: " + JSON.stringify(data));

    return {
      success: true,
      message: "Transaction saved"
    };

  } catch (error) {
    Logger.log("❌ Insert error: " + error.toString());
    Logger.log("Stack: " + error.stack);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Get monthly summary
 */
function getMonthlySummary(year, month) {
  try {
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();

    // Skip header row
    const transactions = data.slice(1);

    let totalDebit = 0;
    let totalCredit = 0;
    let count = 0;

    transactions.forEach(row => {
      const dateStr = row[1]; // Date column
      const amount = parseFloat(row[2]); // Amount column
      const type = row[4]; // Type column

      if (!dateStr) return;

      // Check if date matches month/year
      if (dateStr.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
        count++;
        if (type === "Debit") {
          totalDebit += amount;
        } else if (type === "Credit") {
          totalCredit += amount;
        }
      }
    });

    return {
      month: month,
      year: year,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      netTotal: (totalCredit - totalDebit).toFixed(2),
      count: count
    };

  } catch (error) {
    Logger.log("Summary error: " + error.toString());
    return null;
  }
}

/**
 * Get all transactions for a date range
 */
function getTransactions(startDate, endDate) {
  try {
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();

    // Skip header row
    const transactions = data.slice(1);

    const filtered = transactions.filter(row => {
      const dateStr = row[1]; // Date column
      return dateStr >= startDate && dateStr <= endDate;
    });

    return filtered;

  } catch (error) {
    Logger.log("Get transactions error: " + error.toString());
    return [];
  }
}

/**
 * Delete transaction by row number
 */
function deleteTransaction(rowNumber) {
  try {
    const sheet = initializeSheet();
    sheet.deleteRow(rowNumber + 1); // +1 for header row
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ==========================================
// Response Handler
// ==========================================

/**
 * Build standardized response with proper CORS headers
 */
function buildResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };

  if (data) {
    response.data = data;
  }

  // Use ContentService for JSON with CORS
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
}

// ==========================================
// Additional Helper Functions
// ==========================================

/**
 * Test the script locally (for debugging)
 */
function testInsert() {
  const testData = {
    date: "2026-02-15",
    amount: 45.75,
    currency: "AED",
    type: "Debit",
    merchant: "Carrefour",
    card_last4: "1234",
    category: "Groceries",
    raw: "AED 45.75 spent at Carrefour on 15-02-2026"
  };

  const result = insertTransaction(testData);
  Logger.log("Test result: " + JSON.stringify(result));
}

/**
 * Diagnostic function to check what's in the sheet
 */
function diagnoseSheet() {
  Logger.log("🔍 DIAGNOSTIC TEST");
  Logger.log("Spreadsheet ID: " + SPREADSHEET_ID);
  Logger.log("Sheet Name: " + SHEET_NAME);
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log("✅ Spreadsheet opened successfully");
    
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log("❌ Sheet '" + SHEET_NAME + "' not found!");
      Logger.log("Available sheets: " + ss.getSheets().map(s => s.getName()).join(", "));
      return;
    }
    
    Logger.log("✅ Sheet '" + SHEET_NAME + "' found");
    
    // Get all data
    const data = sheet.getDataRange().getValues();
    Logger.log("📊 Total rows: " + data.length);
    Logger.log("📊 Total columns: " + (data[0] ? data[0].length : 0));
    
    // Log headers
    if (data.length > 0) {
      Logger.log("📋 Headers: " + JSON.stringify(data[0]));
    }
    
    // Log all data rows
    Logger.log("📄 All data rows:");
    for (let i = 1; i < data.length; i++) {
      Logger.log("  Row " + (i + 1) + ": " + JSON.stringify(data[i]));
    }
    
    // Count non-empty rows
    let nonEmptyCount = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0] !== "") {
        nonEmptyCount++;
      }
    }
    Logger.log("✅ Non-empty data rows: " + nonEmptyCount);
    
  } catch (error) {
    Logger.log("❌ Error: " + error.toString());
    Logger.log("Stack: " + error.stack);
  }
}

/**
 * Get summary for current month
 */
function getCurrentMonthSummary() {
  const today = new Date();
  const summary = getMonthlySummary(
    today.getFullYear(),
    today.getMonth() + 1
  );
  Logger.log("Summary: " + JSON.stringify(summary));
  return summary;
}

/**
 * Reset sheet (delete all data except headers)
 */
function resetSheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    }
    
    return { success: true, message: "Sheet reset" };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
