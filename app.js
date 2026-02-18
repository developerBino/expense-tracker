// ==========================================
// Configuration
// ==========================================

// Use the Vercel API endpoint (no CORS issues since it's same origin)
const API_URL = "/api/submit";

// Codes for authentication - will be loaded from /api/auth-config
let AUTH_CODES = {};

// ==========================================
// Data Structure
// ==========================================

let currentParsedData = null;
let parsedHistory = []; // To prevent duplicates
let currentUser = null; // Store current logged-in user
let charts = {}; // Store chart instances
let allTransactions = []; // Store transactions fetched from Google Sheets

// ==========================================
// Authentication & Page Navigation
// ==========================================

/**
 * Show login page and hide app page
 */
function showLoginPage() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('appPage').classList.remove('active');
    currentUser = null;
    sessionStorage.removeItem('currentUser');
}

/**
 * Show app page and hide login page
 */
function showAppPage() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('appPage').classList.add('active');
}

/**
 * Handle login
 */
function handleLogin(code) {
    if (!AUTH_CODES[code]) {
        showError('Invalid code. Please try again.');
        return false;
    }

    const userData = AUTH_CODES[code];
    currentUser = {
        code: code,
        name: userData.name,
        id: userData.id,
        loginTime: new Date()
    };

    // Store in session storage
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));

    // Update UI
    document.getElementById('loggedInUser').textContent = currentUser.name;

    // Show app page
    showAppPage();

    hideError();
    console.log('✅ User logged in:', currentUser);
    return true;
}

/**
 * Handle logout
 */
function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    
    // Reset UI
    document.getElementById('smsInput').value = '';
    togglePreview(false);
    toggleEditSection(false);
    currentParsedData = null;
    
    showLoginPage();
    showToast('Logged out successfully', 'info');
}

/**
 * Check if user is logged in, restore session if available
 */
async function restoreSession() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            document.getElementById('loggedInUser').textContent = currentUser.name;
            showAppPage();
            console.log('✅ Session restored for:', currentUser.name);
            // Fetch fresh data from Google Sheets
            await updateMonthlySummary();
            await updateCharts();
        } catch (e) {
            console.error('Failed to restore session:', e);
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
}

// ==========================================
// Category Detection Rules
// ==========================================

const CATEGORY_RULES = {
    Groceries: ['carrefour', 'lulu', 'union', 'safeway', 'choithrams', 'spinneys'],
    Shopping: ['amazon', 'noon', 'shein', 'h&m', 'zara', 'forever 21'],
    Fuel: ['adnoc', 'enoc', 'shell', 'bp'],
    Food: ['talabat', 'deliveroo', 'uber eats', 'zomato', 'restaurant'],
};

// ==========================================
// Date Parsing
// ==========================================

/**
 * Parse date in multiple formats:
 * - DD-MM-YYYY
 * - DD/MM/YYYY
 * - DD Mon YYYY (e.g., 15 Feb 2026)
 * - Mon DD YYYY (e.g., Feb 16 2026)
 * @param {string} dateStr
 * @returns {string} Formatted as YYYY-MM-DD or empty string if invalid
 */
function parseDate(dateStr) {
    if (!dateStr) return '';

    dateStr = dateStr.trim();

    // Pattern: DD-MM-YYYY or DD/MM/YYYY
    const dashPattern = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/;
    const dashMatch = dateStr.match(dashPattern);
    if (dashMatch) {
        const day = String(dashMatch[1]).padStart(2, '0');
        const month = String(dashMatch[2]).padStart(2, '0');
        const year = dashMatch[3];
        return `${year}-${month}-${day}`;
    }

    // Month names mapping
    const monthNames = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };

    // Pattern: DD Mon YYYY (e.g., 15 Feb 2026)
    const wordPattern = /(\d{1,2})\s+([a-z]{3})\s+(\d{4})/i;
    const wordMatch = dateStr.match(wordPattern);
    if (wordMatch) {
        const day = String(wordMatch[1]).padStart(2, '0');
        const monthStr = wordMatch[2].toLowerCase();
        const month = monthNames[monthStr];
        const year = wordMatch[3];
        if (month) {
            return `${year}-${month}-${day}`;
        }
    }

    // Pattern: Mon DD YYYY (e.g., Feb 16 2026)
    const reverseWordPattern = /([a-z]{3})\s+(\d{1,2})\s+(\d{4})/i;
    const reverseWordMatch = dateStr.match(reverseWordPattern);
    if (reverseWordMatch) {
        const monthStr = reverseWordMatch[1].toLowerCase();
        const day = String(reverseWordMatch[2]).padStart(2, '0');
        const year = reverseWordMatch[3];
        const month = monthNames[monthStr];
        if (month) {
            return `${year}-${month}-${day}`;
        }
    }

    return '';
}

// ==========================================
// Amount and Currency Parsing
// ==========================================

/**
 * Extract amount and currency from message
 * @param {string} message
 * @returns {object} { amount: number, currency: string }
 */
function parseAmountAndCurrency(message) {
    // Look for currency codes (AED, USD, EUR, etc.)
    const currencyPattern = /([A-Z]{3})\s*([\d,]+\.?\d*)/;
    const match = message.match(currencyPattern);

    if (match) {
        const currency = match[1];
        const amountStr = match[2].replace(/,/g, ''); // Remove commas
        const amount = parseFloat(amountStr);

        return {
            amount: isNaN(amount) ? 0 : amount,
            currency: currency,
        };
    }

    // Default to AED if not found
    return {
        amount: 0,
        currency: 'AED',
    };
}

// ==========================================
// Transaction Type Detection
// ==========================================

/**
 * Detect if transaction is Credit or Debit
 * @param {string} message
 * @returns {string} 'Credit' or 'Debit'
 */
function detectTransactionType(message) {
    const creditKeywords = ['credited', 'received', 'transfered', 'transferred', 'refund', 'deposited'];
    const debitKeywords = ['spent', 'purchase', 'debited', 'charged', 'withdrawn', 'transfer out'];

    const lowerMessage = message.toLowerCase();

    for (let keyword of creditKeywords) {
        if (lowerMessage.includes(keyword)) {
            return 'Credit';
        }
    }

    for (let keyword of debitKeywords) {
        if (lowerMessage.includes(keyword)) {
            return 'Debit';
        }
    }

    // Default
    return 'Debit';
}

// ==========================================
// Merchant Extraction
// ==========================================

/**
 * Extract merchant name from message
 * Look for text after "at" or "via" keyword
 * @param {string} message
 * @returns {string} Merchant name or empty string
 */
function extractMerchant(message) {
    // Try "at" keyword first
    const atPattern = /at\s+([A-Za-z0-9&\s'-]+?)(?:\s+on|\s+using|\s+with|$)/i;
    const atMatch = message.match(atPattern);
    if (atMatch) {
        return atMatch[1].trim();
    }

    // Try "via" keyword
    const viaPattern = /via\s+([A-Za-z0-9&\s'/\-]+?)(?:\s+from|\s+on|\s+using|\s+with|$)/i;
    const viaMatch = message.match(viaPattern);
    if (viaMatch) {
        return viaMatch[1].trim();
    }

    // Try generic pattern for merchant at start
    const genericPattern = /^([A-Z][A-Za-z0-9&\s'-]+?)(?:\s+transferred|\s+spent|\s+purchase)/i;
    const genericMatch = message.match(genericPattern);
    if (genericMatch) {
        return genericMatch[1].trim();
    }

    return '';
}

// ==========================================
// Card Last 4 Digits Extraction
// ==========================================

/**
 * Extract last 4 digits of card from message
 * @param {string} message
 * @returns {string} Last 4 digits or empty string
 */
function extractCardLast4(message) {
    const cardPattern = /(?:ending|card|number)?\s*(\d{4})/i;
    const match = message.match(cardPattern);

    if (match) {
        return match[1];
    }

    return '';
}

// ==========================================
// Category Auto-Detection
// ==========================================

/**
 * Auto-detect category based on merchant name
 * @param {string} merchant
 * @returns {string} Category name
 */
function detectCategory(merchant) {
    if (!merchant) return 'Other';

    const merchantLower = merchant.toLowerCase();

    for (let [category, keywords] of Object.entries(CATEGORY_RULES)) {
        for (let keyword of keywords) {
            if (merchantLower.includes(keyword)) {
                return category;
            }
        }
    }

    return 'Other';
}

// ==========================================
// Advanced SMS Parser
// ==========================================

/**
 * Extract transaction data from ADCB bank SMS messages
 * Handles multiple SMS formats: debit card, credit card, transfers, ATM withdrawals, credits
 * @param {string} smsMessage
 * @returns {object} Parsed transaction data
 */
function extractSMSData(smsMessage) {
    console.log('🔍 Parsing SMS:', smsMessage);

    const message = smsMessage.trim();
    let date = '';
    let amount = 0;
    let type = 'Debit'; // Default to Debit
    let merchant = '';
    let cardLast4 = '';

    // ===== PATTERN 1: Debit Card Transaction =====
    // "Your debit card XXX9098 linked to acc. XXX910001 was used for AED15.75 on Feb 16 2026  8:52PM at OOTTUPURA RESTA,AE"
    if (message.includes('debit card') && message.includes('was used for')) {
        console.log('  📌 Detected: Debit Card Transaction');
        
        type = 'Debit';

        // Extract card last 4
        const cardMatch = message.match(/debit card\s+XXX(\d{4})/i);
        if (cardMatch) {
            cardLast4 = cardMatch[1];
        }

        // Extract amount - look for "AED" or just numbers
        const amountMatch = message.match(/was used for\s+AED\s*([\d.]+)/i);
        if (amountMatch) {
            amount = parseFloat(amountMatch[1]);
        }

        // Extract date
        const dateMatch = message.match(/on\s+(.*?)\s+at/i);
        if (dateMatch) {
            date = parseDate(dateMatch[1]);
        }

        // Extract merchant - text between "at" and comma or end
        const merchantMatch = message.match(/at\s+([^,]+)/i);
        if (merchantMatch) {
            merchant = merchantMatch[1].trim();
        }
    }
    // ===== PATTERN 2: Credit Card Transaction =====
    // "Your Cr.Card XXX5186 was used for AED10.00 on 17/02/2026 17:27:35 at NEW GRILL LAND REST,DUBAI-AE"
    else if ((message.includes('Cr.Card') || message.includes('credit card')) && message.includes('was used for')) {
        console.log('  📌 Detected: Credit Card Transaction');
        
        type = 'Debit'; // Card spending is a debit

        // Extract card last 4
        const cardMatch = message.match(/(?:Cr\.Card\s+XXX|credit card.*?XXX)(\d{4})/i);
        if (cardMatch) {
            cardLast4 = cardMatch[1];
        }

        // Extract amount
        const amountMatch = message.match(/was used for\s+AED\s*([\d.]+)/i);
        if (amountMatch) {
            amount = parseFloat(amountMatch[1]);
        }

        // Extract date - handles "17/02/2026 17:27:35" format
        const dateMatch = message.match(/on\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dateMatch) {
            date = parseDate(dateMatch[1]);
        }

        // Extract merchant
        const merchantMatch = message.match(/at\s+([^,]+)/i);
        if (merchantMatch) {
            merchant = merchantMatch[1].trim();
        }
    }
    // ===== PATTERN 3: Credit/Deposit Transaction =====
    // "A Cr. transaction of AED 2100.00 on your account no. XXX910001 was successful"
    else if (message.includes('Cr. transaction') || message.toLowerCase().includes('credit') && message.includes('successful')) {
        console.log('  📌 Detected: Credit Transaction');
        
        type = 'Credit';

        // Extract amount
        const amountMatch = message.match(/of\s+AED\s*([\d.]+)/i);
        if (amountMatch) {
            amount = parseFloat(amountMatch[1]);
        }

        // For credit transactions without explicit date, we need to find it or use today
        const dateMatch = message.match(/on\s+([^.]+?)\s+(was|at)/i) || message.match(/on\s+([^.]+?)(?:\.|$)/i);
        if (dateMatch) {
            date = parseDate(dateMatch[1]);
        }

        // No merchant typically for direct credits
        merchant = 'Bank Credit';
    }
    // ===== PATTERN 4: Transfer via Mobile/Internet Banking =====
    // "AED2067.00 transferred via ADCB Personal Internet Banking / Mobile App from acc. no. XXX910001 on Feb 16 2026 10:53PM"
    else if (message.includes('transferred') || message.includes('transfer')) {
        console.log('  📌 Detected: Transfer');
        
        type = message.toLowerCase().includes('transfer out') ? 'Debit' : (
            message.toLowerCase().includes('transferred via') ? 'Debit' : 'Credit'
        );

        // Extract amount - at the beginning
        const amountMatch = message.match(/^AED\s*([\d.]+)|of\s+AED\s*([\d.]+)/i);
        if (amountMatch) {
            amount = parseFloat(amountMatch[1] || amountMatch[2]);
        }

        // Extract date
        const dateMatch = message.match(/on\s+(.*?)(?:\.|$)/i);
        if (dateMatch) {
            date = parseDate(dateMatch[1]);
        }

        merchant = 'Bank Transfer';
    }
    // ===== PATTERN 5: ATM Withdrawal =====
    // "AED200.00 withdrawn from acc. XXX910001 on Feb  5 2026 12:57PM at ATM-EMIRATES BANK INTL    DUB"
    else if (message.includes('withdrawn') && message.includes('ATM')) {
        console.log('  📌 Detected: ATM Withdrawal');
        
        type = 'Debit';

        // Extract amount
        const amountMatch = message.match(/^AED\s*([\d.]+)/i);
        if (amountMatch) {
            amount = parseFloat(amountMatch[1]);
        }

        // Extract date
        const dateMatch = message.match(/on\s+(.*?)\s+at/i);
        if (dateMatch) {
            date = parseDate(dateMatch[1]);
        }

        merchant = 'ATM Withdrawal';
    }
    // ===== FALLBACK: Generic Amount and Date Extraction =====
    else {
        console.log('  📌 Detected: Generic Transaction (fallback)');
        
        // Try to extract amount
        const amountMatch = message.match(/AED\s+([\d.]+)|[\d.]+\s+AED/i);
        if (amountMatch) {
            amount = parseFloat(amountMatch[1] || amountMatch[0].match(/[\d.]+/)[0]);
        }

        // Try to extract date
        const dateMatch = message.match(/(?:on|date)\s+(.*?)(?:at|$)/i);
        if (dateMatch) {
            date = parseDate(dateMatch[1]);
        }

        merchant = 'Transaction';
    }

    // Fallback to today if no date found
    if (!date) {
        const today = new Date();
        date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        console.log('  ⚠️  No date found, using today:', date);
    }

    // Clean merchant name
    merchant = merchant.replace(/,AE$/i, '').replace(/[,-]+$/, '').trim();

    const result = {
        date,
        amount,
        currency: 'AED',
        type,
        merchant,
        card_last4: cardLast4,
        category: detectCategory(merchant),
        raw: message
    };

    console.log('  ✅ Extraction result:', result);
    return result;
}

// ==========================================
// Main Parser Function
// ==========================================

/**
 * Parse SMS message and extract structured data
 * @param {string} smsMessage
 * @returns {object} Parsed transaction data
 */
function parseSMSMessage(smsMessage) {
    const cleanMessage = smsMessage.trim();

    if (!cleanMessage) {
        throw new Error('Please paste an SMS message');
    }

    // Check for duplicate
    if (parsedHistory.includes(cleanMessage)) {
        throw new Error('This message has already been parsed');
    }

    try {
        // Extract data using JavaScript parser
        const parsedData = extractSMSData(cleanMessage);

        // Ensure all required fields exist
        parsedData.card_last4 = parsedData.card_last4 || '';
        parsedData.category = parsedData.category || 'Other';

        // Validate required fields
        if (!parsedData.date || !parsedData.amount || !parsedData.currency || !parsedData.type) {
            throw new Error('Could not extract all required fields from SMS');
        }

        // Add to history to prevent duplicates
        parsedHistory.push(cleanMessage);

        console.log('✅ SMS parsed successfully:', parsedData);
        return parsedData;

    } catch (error) {
        console.error('❌ SMS parsing error:', error.message);
        throw error;
    }
}

// ==========================================
// UI Functions
// ==========================================

// ==========================================
// Fetch Data from Google Sheets
// ==========================================

/**
 * Fetch all transactions from Google Sheets via API
 */
async function fetchTransactionsFromGoogleSheets() {
    try {
        console.log('🌐 Fetching transactions from Google Sheets...');
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            console.error('❌ HTTP Error:', response.statusText);
            return [];
        }

        const responseText = await response.text();
        console.log('📋 Raw response from API:', responseText);
        
        const responseData = JSON.parse(responseText);
        console.log('📦 Parsed response data:', responseData);
        console.log('📊 Response success:', responseData.success);
        console.log('📊 Response data array:', responseData.data);
        console.log('📊 Response count:', responseData.count);

        if (responseData.success && responseData.data) {
            console.log('✅ Retrieved', responseData.count, 'transactions from Google Sheets');
            
            if (responseData.data.length === 0) {
                console.warn('⚠️ Data array is empty');
                return [];
            }
            
            // Log the first transaction to see the structure
            console.log('🔍 First transaction structure:', JSON.stringify(responseData.data[0]));
            
            // Convert from Google Sheets format to our format
            const transactions = responseData.data.map((row, index) => {
                console.log(`📄 Processing transaction ${index}:`, row);
                const converted = {
                    timestamp: row.timestamp || '',
                    user: row.user || '',
                    date: row.date || '',
                    amount: parseFloat(row.amount) || 0,
                    currency: row.currency || 'AED',
                    type: row.type || 'Debit',
                    merchant: row.merchant || '',
                    card_last4: row.card_last_4 || '',
                    category: row.category || 'Other',
                    raw: row.raw_message || ''
                };
                console.log(`✅ Converted to:`, converted);
                return converted;
            });
            
            allTransactions = transactions;
            console.log('💾 All transactions stored:', allTransactions.length);
            return transactions;
        } else {
            console.warn('⚠️ No data returned from Google Sheets');
            console.warn('Response:', responseData);
            return [];
        }
    } catch (error) {
        console.error('❌ Error fetching from Google Sheets:', error);
        return [];
    }
}

// ==========================================
// UI Functions
// ==========================================

/**
 * Show/hide preview section
 */
function togglePreview(show = true) {
    const previewSection = document.getElementById('previewSection');
    if (show) {
        previewSection.classList.remove('hidden');
    } else {
        previewSection.classList.add('hidden');
    }
}

/**
 * Populate preview with parsed data
 */
function populatePreview(data) {
    document.getElementById('previewDate').textContent = data.date || '-';
    document.getElementById('previewAmount').textContent = `${data.currency} ${data.amount.toFixed(2)}`;
    document.getElementById('previewCurrency').textContent = data.currency;
    document.getElementById('previewType').textContent = data.type;
    document.getElementById('previewMerchant').textContent = data.merchant || '-';
    document.getElementById('previewCard').textContent = data.card_last4 || '-';
    document.getElementById('previewCategory').textContent = data.category;
    document.getElementById('previewRaw').textContent = data.raw;
}

/**
 * Show error message
 */
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 5000);
}

/**
 * Hide error message
 */
function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

/**
 * Update monthly summary from Google Sheets data
 */
async function updateMonthlySummary() {
    const today = new Date();
    const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Fetch fresh data from Google Sheets
    const transactions = await fetchTransactionsFromGoogleSheets();
    console.log('📊 updateMonthlySummary - Total transactions from Google Sheets:', transactions.length);

    // Filter by current year
    const monthTransactions = transactions.filter(t => {
        if (!t.date) {
            console.warn('⚠️ Transaction missing date:', t);
            return false;
        }
        const isThisYear = t.date.startsWith(today.getFullYear().toString());
        console.log('🔍 Checking transaction date:', t.date, '- This year?', isThisYear);
        return isThisYear;
    });

    console.log('📊 Transactions this year:', monthTransactions.length);

    let totalDebit = 0;
    let totalCredit = 0;

    monthTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'Debit') {
            totalDebit += amount;
            console.log('💸 Debit:', amount, '- Running total:', totalDebit);
        } else {
            totalCredit += amount;
            console.log('💰 Credit:', amount, '- Running total:', totalCredit);
        }
    });

    const netTotal = totalCredit - totalDebit;

    console.log('💹 Final Summary - Debit:', totalDebit, 'Credit:', totalCredit, 'Net:', netTotal);

    document.getElementById('totalDebit').textContent = `AED ${totalDebit.toFixed(2)}`;
    document.getElementById('totalCredit').textContent = `AED ${totalCredit.toFixed(2)}`;
    document.getElementById('netTotal').textContent = `AED ${netTotal.toFixed(2)}`;
    document.getElementById('transactionCount').textContent = monthTransactions.length;
}

/**
 * Set button loading state
 */
function setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span><span class="btn-text">Processing...</span>';
    } else {
        button.disabled = false;
        button.innerHTML = '<span class="btn-text">Parse Message</span>';
    }
}

/**
 * Set save button loading state
 */
function setSaveButtonLoading(isLoading) {
    const button = document.getElementById('saveBtn');
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span><span class="btn-text">Saving...</span>';
    } else {
        button.disabled = false;
        button.innerHTML = '<span class="btn-text">💾 Save to Google Sheets</span>';
    }
}

/**
 * Show/hide edit section
 */
function toggleEditSection(show = true) {
    const editSection = document.getElementById('editSection');
    if (show) {
        editSection.classList.remove('hidden');
    } else {
        editSection.classList.add('hidden');
    }
}

/**
 * Update charts with transaction data from Google Sheets
 */
async function updateCharts() {
    const transactions = allTransactions; // Use already-fetched data
    
    if (transactions.length === 0) {
        console.log('📊 No transactions to display in charts');
        return;
    }

    // Data by category
    const categoryData = {};
    const typeData = { Debit: 0, Credit: 0 };
    const dailyData = {};

    transactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const category = t.category || 'Other';
        const type = t.type || 'Debit';
        const date = t.date || new Date().toISOString().split('T')[0];

        // Category totals
        categoryData[category] = (categoryData[category] || 0) + amount;

        // Type totals
        if (type === 'Debit') {
            typeData.Debit += amount;
        } else {
            typeData.Credit += amount;
        }

        // Daily totals
        if (!dailyData[date]) {
            dailyData[date] = 0;
        }
        if (type === 'Debit') {
            dailyData[date] += amount;
        }
    });

    // Category Chart
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        if (charts.categoryChart) {
            charts.categoryChart.destroy();
        }

        charts.categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryData),
                datasets: [{
                    data: Object.values(categoryData),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Type Chart (Debit vs Credit)
    const typeCtx = document.getElementById('typeChart');
    if (typeCtx) {
        if (charts.typeChart) {
            charts.typeChart.destroy();
        }

        charts.typeChart = new Chart(typeCtx, {
            type: 'bar',
            data: {
                labels: ['Debit', 'Credit'],
                datasets: [{
                    label: 'Amount (AED)',
                    data: [typeData.Debit, typeData.Credit],
                    backgroundColor: ['#FF6384', '#4BC0C0'],
                    borderColor: ['#FF6384', '#4BC0C0'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Trend Chart (Daily spending)
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        if (charts.trendChart) {
            charts.trendChart.destroy();
        }

        const sortedDates = Object.keys(dailyData).sort();
        charts.trendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'Daily Spending (AED)',
                    data: sortedDates.map(date => dailyData[date]),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }
}

// ==========================================
// Initialize & Event Listeners
// ==========================================

/**
 * Load authentication configuration from API
 */
async function loadAuthConfig() {
    try {
        const response = await fetch('/api/auth-config');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.authCodes) {
                AUTH_CODES = data.authCodes;
                console.log('✅ Auth codes loaded from server');
                
                // Update auth info display
                const authInfoContainer = document.getElementById('authInfoContainer');
                if (authInfoContainer) {
                    let htmlContent = '';
                    for (const [code, userInfo] of Object.entries(AUTH_CODES)) {
                        htmlContent += `<p><i class="fas fa-key"></i> <strong>${code}:</strong> ${userInfo.name}</p>`;
                    }
                    authInfoContainer.innerHTML = htmlContent;
                }
            }
        }
    } catch (error) {
        console.error('⚠️ Failed to load auth config, using default fallback');
        // Fallback - won't have any codes, forcing server-side validation only
        AUTH_CODES = {};
        const authInfoContainer = document.getElementById('authInfoContainer');
        if (authInfoContainer) {
            authInfoContainer.innerHTML = '<p><em>Contact administrator for login credentials</em></p>';
        }
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    // Load authentication configuration first
    await loadAuthConfig();
    
    // Restore session or show login
    restoreSession();

    // Disable save button initially
    document.getElementById('saveBtn').disabled = true;

    /**
     * Handle Login Form Submit
     */
    document.getElementById('loginForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const code = document.getElementById('authCode').value;
        
        if (handleLogin(code)) {
            // Clear form
            document.getElementById('loginForm').reset();
            // Fetch data from Google Sheets after login
            await updateCharts();
        }
    });

    /**
     * Handle Logout Button
     */
    document.getElementById('logoutBtn').addEventListener('click', function () {
        handleLogout();
    });

    /**
     * Handle Parse button click
     */
    document.getElementById('parseBtn').addEventListener('click', function () {
        hideError();
        const smsInput = document.getElementById('smsInput').value;

        console.log('🔍 Parsing SMS:', smsInput);

        try {
            currentParsedData = parseSMSMessage(smsInput);
            console.log('✅ Parsed successfully:', currentParsedData);
            populatePreview(currentParsedData);
            togglePreview(true);
            toggleEditSection(false);
            document.getElementById('saveBtn').disabled = false;
        } catch (error) {
            console.error('❌ Parsing error:', error.message);
            showError(error.message);
            togglePreview(false);
            currentParsedData = null;
        }
    });

    /**
     * Handle Edit button click
     */
    document.getElementById('editBtn').addEventListener('click', function () {
        if (currentParsedData) {
            // Populate edit form with current data
            document.getElementById('editDate').value = currentParsedData.date;
            document.getElementById('editAmount').value = currentParsedData.amount;
            document.getElementById('editCurrency').value = currentParsedData.currency;
            document.getElementById('editType').value = currentParsedData.type;
            document.getElementById('editMerchant').value = currentParsedData.merchant;
            document.getElementById('editCard').value = currentParsedData.card_last4;
            document.getElementById('editCategory').value = currentParsedData.category;
            
            toggleEditSection(true);
        }
    });

    /**
     * Handle Save Edit button click
     */
    document.getElementById('saveEditBtn').addEventListener('click', function () {
        if (currentParsedData) {
            // Update parsed data from form
            currentParsedData.date = document.getElementById('editDate').value;
            currentParsedData.amount = parseFloat(document.getElementById('editAmount').value);
            currentParsedData.currency = document.getElementById('editCurrency').value;
            currentParsedData.type = document.getElementById('editType').value;
            currentParsedData.merchant = document.getElementById('editMerchant').value;
            currentParsedData.card_last4 = document.getElementById('editCard').value;
            currentParsedData.category = document.getElementById('editCategory').value;
            
            // Update preview
            populatePreview(currentParsedData);
            toggleEditSection(false);
            showToast('Details updated', 'success');
        }
    });

    /**
     * Handle Cancel Edit button click
     */
    document.getElementById('cancelEditBtn').addEventListener('click', function () {
        toggleEditSection(false);
    });

    /**
     * Handle Save to Google Sheets button click
     */
    document.getElementById('saveBtn').addEventListener('click', async function () {
        if (!currentParsedData) {
            showError('No parsed data to save');
            console.error('❌ No parsed data available');
            return;
        }

        if (!currentUser) {
            showError('Please login first');
            return;
        }

        if (!API_URL || API_URL === "PASTE_GOOGLE_SCRIPT_URL_HERE") {
            showError('Google Apps Script URL not configured');
            console.error('❌ API_URL not configured:', API_URL);
            return;
        }

        setSaveButtonLoading(true);
        
        // Add user name to data
        const dataToSave = {
            ...currentParsedData,
            user: currentUser.name
        };

        console.log('📤 Sending to Google Sheets:', dataToSave);
        console.log('📡 API URL:', API_URL);
        console.log('👤 Current User:', currentUser.name);

        try {
            console.log('🌐 Initiating fetch request...');
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave),
            });

            console.log('📊 Response Status:', response.status);
            console.log('📊 Response OK:', response.ok);
            const responseText = await response.text();
            console.log('📋 Response Text:', responseText);
            console.log('📋 Response Length:', responseText.length);

            if (!response.ok) {
                console.error('❌ HTTP Error:', response.statusText);
                throw new Error(`Server error: ${response.statusText} - ${responseText}`);
            }

            // Parse response
            let responseData;
            try {
                responseData = JSON.parse(responseText);
                console.log('✅ Server Response:', responseData);
            } catch (parseErr) {
                console.error('❌ Failed to parse response as JSON:', parseErr);
                console.log('Raw response:', responseText.substring(0, 200));
                throw new Error('Invalid response from server');
            }

            // Check if this was a local fallback or actual Google Sheets save
            const savedToGoogleSheets = responseData.source !== 'local_cache';
            if (savedToGoogleSheets) {
                console.log('☁️ ✅ Data saved to GOOGLE SHEETS');
            } else {
                console.log('⚠️ ⚠️ Data saved to LOCAL CACHE ONLY (Google Sheets unavailable)');
                console.log('⚠️ Please check Google Apps Script deployment');
            }

            // Show message based on save result
            if (savedToGoogleSheets) {
                showToast('✓ Saved to Google Sheets!', 'success');
                console.log('✅ Transaction saved to Google Sheets');
            } else {
                showToast('⚠️ Google Sheets unavailable - transaction not saved', 'warning');
                console.log('⚠️ Transaction not saved to Google Sheets');
            }

            // Clear form and preview
            document.getElementById('smsInput').value = '';
            togglePreview(false);
            toggleEditSection(false);
            currentParsedData = null;

            // Refresh data from Google Sheets
            if (savedToGoogleSheets) {
                console.log('📊 Refreshing summary from Google Sheets...');
                await updateMonthlySummary();
                console.log('📈 Refreshing charts from Google Sheets...');
                await updateCharts();
                console.log('✅ All updates complete');
            }

        } catch (error) {
            console.error('❌ Save error:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            showError(`Failed to save: ${error.message}`);
        } finally {
            setSaveButtonLoading(false);
        }
    });

    /**
     * Clear error on input focus
     */
    document.getElementById('smsInput').addEventListener('focus', hideError);
    document.getElementById('authCode').addEventListener('focus', hideError);
});
