// ==========================================
// Google Apps Script - Expense Tracker Backend
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
    Logger.log("GET request received");
    
    // Open spreadsheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log("Spreadsheet opened");
    
    // List all sheets
    const allSheets = ss.getSheets();
    const sheetNames = allSheets.map(s => s.getName()).join(", ");
    Logger.log("Available sheets: " + sheetNames);
    
    // Get the sheet
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log("ERROR: Sheet '" + SHEET_NAME + "' not found!");
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Sheet '" + SHEET_NAME + "' not found. Available: " + sheetNames,
        data: [],
        count: 0
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    Logger.log("Sheet found: " + SHEET_NAME);
    
    // Get all data
    const data = sheet.getDataRange().getValues();
    Logger.log("Total rows: " + data.length);
    
    // If only headers or empty
    if (data.length <= 1) {
      Logger.log("No data rows (only headers or empty)");
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
    
    // Extract headers
    const headers = data[0];
    Logger.log("Headers: " + JSON.stringify(headers));
    
    // Convert rows to objects
    const transactions = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Skip empty rows
      if (!row[0] || row[0] === "") {
        Logger.log("Skipping empty row " + i);
        continue;
      }
      
      Logger.log("Processing row " + i);
      
      const transaction = {};
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/\s+/g, '_');
        transaction[key] = row[index];
      });
      
      transactions.push(transaction);
      Logger.log("Row " + i + " added: " + JSON.stringify(transaction).substring(0, 100));
    }
    
    Logger.log("Total transactions: " + transactions.length);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: transactions,
      count: transactions.length,
      timestamp: new Date().toISOString()
    }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
      
  } catch (error) {
    Logger.log("ERROR in doGet: " + error.toString());
    Logger.log("Stack: " + error.stack);
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
    Logger.log("POST request received");
    
    if (!e.postData || !e.postData.contents) {
      Logger.log("ERROR: No post data");
      return buildResponse(false, "No post data received");
    }
    
    Logger.log("Request content: " + e.postData.contents);
    
    // Parse incoming JSON data
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
      Logger.log("Payload parsed successfully");
      Logger.log("Payload keys: " + Object.keys(payload).join(", "));
    } catch (parseErr) {
      Logger.log("ERROR parsing JSON: " + parseErr.toString());
      return buildResponse(false, "Invalid JSON: " + parseErr.toString());
    }

    // Validate data
    Logger.log("Validating transaction");
    const validation = validateTransaction(payload);
    Logger.log("Validation result: " + JSON.stringify(validation));
    
    if (!validation.valid) {
      Logger.log("Validation failed: " + validation.error);
      return buildResponse(false, validation.error);
    }

    // Insert data into Google Sheet
    Logger.log("Inserting transaction");
    const result = insertTransaction(payload);
    Logger.log("Insert result: " + JSON.stringify(result));
    
    if (result.success) {
      Logger.log("Transaction saved successfully");
      return buildResponse(true, "Transaction saved successfully");
    } else {
      Logger.log("Insert failed: " + result.error);
      return buildResponse(false, "Insert failed: " + result.error);
    }

  } catch (error) {
    Logger.log("ERROR in doPost: " + error.toString());
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
  Logger.log("validateTransaction called");
  Logger.log("Data keys: " + Object.keys(data).join(", "));
  
  // Check required fields
  const requiredFields = ['date', 'amount', 'currency', 'type'];
  
  for (let i = 0; i < requiredFields.length; i++) {
    const field = requiredFields[i];
    Logger.log("Checking field: " + field + " = " + data[field]);
    
    if (data[field] === null || data[field] === undefined || data[field] === "") {
      Logger.log("Missing required field: " + field);
      return {
        valid: false,
        error: "Missing required field: " + field
      };
    }
  }

  // Validate amount is a number
  const amount = parseFloat(data.amount);
  if (isNaN(amount)) {
    Logger.log("Invalid amount: " + data.amount);
    return {
      valid: false,
      error: "Amount must be a valid number"
    };
  }

  // Validate transaction type
  if (data.type !== 'Debit' && data.type !== 'Credit') {
    Logger.log("Invalid type: " + data.type);
    return {
      valid: false,
      error: "Transaction type must be Debit or Credit"
    };
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.date)) {
    Logger.log("Invalid date: " + data.date);
    return {
      valid: false,
      error: "Date must be in YYYY-MM-DD format"
    };
  }

  Logger.log("Validation passed");
  return { valid: true };
}

// ==========================================
// Sheet Operations
// ==========================================

/**
 * Initialize sheet if it doesn't exist
 */
function initializeSheet() {
  Logger.log("Opening spreadsheet: " + SPREADSHEET_ID);
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log("Spreadsheet opened");
    
    let sheet = ss.getSheetByName(SHEET_NAME);

    // If sheet doesn't exist, create it
    if (!sheet) {
      Logger.log("Sheet not found, creating: " + SHEET_NAME);
      sheet = ss.insertSheet(SHEET_NAME);
      Logger.log("Sheet created");
      
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
      
      Logger.log("Adding headers");
      sheet.appendRow(headers);
      
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#667eea");
      headerRange.setFontColor("white");
      headerRange.setFontWeight("bold");
      Logger.log("Headers formatted");
    } else {
      Logger.log("Sheet exists: " + SHEET_NAME);
    }

    return sheet;
    
  } catch (error) {
    Logger.log("ERROR in initializeSheet: " + error.toString());
    throw error;
  }
}

/**
 * Insert transaction into Google Sheet
 */
function insertTransaction(data) {
  try {
    Logger.log("insertTransaction called with data: " + JSON.stringify(data).substring(0, 200));
    
    Logger.log("Step 1: Initializing sheet");
    const sheet = initializeSheet();
    Logger.log("Step 2: Sheet ready: " + sheet.getName());
    
    // Prepare row data - handle all fields safely
    const timestamp = new Date().toISOString();
    Logger.log("Step 3: Timestamp: " + timestamp);
    
    const rowData = [
      timestamp,
      data.user || "Unknown",
      data.date || "",
      Math.abs(parseFloat(data.amount) || 0),
      data.currency || "AED",
      data.type || "Debit",
      data.merchant || "",
      data.card_last4 || "",
      data.category || "Other",
      data.raw || ""
    ];

    Logger.log("Step 4: Row data prepared: " + JSON.stringify(rowData).substring(0, 200));

    Logger.log("Step 5: Appending row to sheet");
    sheet.appendRow(rowData);
    Logger.log("Step 6: Row appended successfully");

    // Auto-fit columns
    Logger.log("Step 7: Resizing columns");
    sheet.autoResizeColumns(1, rowData.length);
    Logger.log("Step 8: Columns resized");

    Logger.log("Step 9: Transaction inserted successfully");

    return {
      success: true,
      message: "Transaction saved"
    };

  } catch (error) {
    Logger.log("ERROR in insertTransaction: " + error.toString());
    Logger.log("Error name: " + error.name);
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
      const dateStr = row[2]; // Date column (index 2)
      const amount = parseFloat(row[3]); // Amount column (index 3)
      const type = row[5]; // Type column (index 5)

      if (!dateStr) return;

      // Check if date matches month/year
      const datePattern = year + "-" + String(month).padStart(2, '0');
      if (String(dateStr).startsWith(datePattern)) {
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

// ==========================================
// Response Handler
// ==========================================

/**
 * Build standardized response with proper CORS headers
 */
function buildResponse(success, message, data = null) {
  try {
    const response = {
      success: success,
      message: message,
      timestamp: new Date().toISOString()
    };

    if (data) {
      response.data = data;
    }

    Logger.log("Returning response: " + JSON.stringify(response).substring(0, 200));

    // Use ContentService for JSON with CORS
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
      .setHeader("Access-Control-Allow-Headers", "Content-Type");
  } catch (error) {
    Logger.log("ERROR in buildResponse: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Error building response",
      error: error.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
}

// ==========================================
// Helper Functions
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
    raw: "Test transaction",
    user: "Test"
  };

  const result = insertTransaction(testData);
  Logger.log("Test result: " + JSON.stringify(result));
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
