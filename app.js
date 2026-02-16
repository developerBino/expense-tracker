// ==========================================
// Configuration
// ==========================================

// Use the Vercel API endpoint (no CORS issues since it's same origin)
const API_URL = "/api/submit";

// ==========================================
// Data Structure
// ==========================================

let currentParsedData = null;
let parsedHistory = []; // To prevent duplicates

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

    const { amount, currency } = parseAmountAndCurrency(cleanMessage);
    const date = parseDate(cleanMessage);
    const type = detectTransactionType(cleanMessage);
    const merchant = extractMerchant(cleanMessage);
    const card_last4 = extractCardLast4(cleanMessage);
    const category = detectCategory(merchant);

    if (amount === 0) {
        throw new Error('Could not extract amount from message');
    }

    const parsedData = {
        date: date,
        amount: amount,
        currency: currency,
        type: type,
        merchant: merchant || 'Unknown',
        card_last4: card_last4,
        category: category,
        raw: cleanMessage,
    };

    // Validate critical fields
    if (!parsedData.date) {
        throw new Error('Could not extract date from message');
    }

    // Add to history to prevent duplicates
    parsedHistory.push(cleanMessage);

    return parsedData;
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
 * Update monthly summary
 */
function updateMonthlySummary() {
    // This would integrate with localStorage or backend data
    // For now, it's a placeholder for future integration
    const today = new Date();
    const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Retrieve from localStorage if available
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');

    // Filter by current month
    const monthTransactions = transactions.filter(t => {
        if (!t.date) return false;
        return t.date.startsWith(today.getFullYear().toString());
    });

    let totalDebit = 0;
    let totalCredit = 0;

    monthTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'Debit') {
            totalDebit += amount;
        } else {
            totalCredit += amount;
        }
    });

    const netTotal = totalCredit - totalDebit;

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
        button.innerHTML = '<span class="btn-text">Save to Google Sheets</span>';
    }
}

// ==========================================
// Initialize & Event Listeners
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    // Load initial summary from localStorage
    updateMonthlySummary();

    // Disable save button initially
    document.getElementById('saveBtn').disabled = true;

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
            document.getElementById('saveBtn').disabled = false;
        } catch (error) {
            console.error('❌ Parsing error:', error.message);
            showError(error.message);
            togglePreview(false);
            currentParsedData = null;
        }
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

        if (!API_URL || API_URL === "PASTE_GOOGLE_SCRIPT_URL_HERE") {
            showError('Google Apps Script URL not configured');
            console.error('❌ API_URL not configured:', API_URL);
            return;
        }

        setSaveButtonLoading(true);
        console.log('📤 Sending to Google Sheets:', currentParsedData);
        console.log('📡 API URL:', API_URL);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(currentParsedData),
            });

            console.log('📊 Response Status:', response.status);
            const responseText = await response.text();
            console.log('📋 Response Text:', responseText);

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText} - ${responseText}`);
            }

            // Parse response
            const responseData = JSON.parse(responseText);
            console.log('✅ Server Response:', responseData);

            // Save to localStorage for local summary
            const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
            transactions.push(currentParsedData);
            localStorage.setItem('transactions', JSON.stringify(transactions));

            showToast('✓ Saved successfully!', 'success');

            // Clear form and preview
            document.getElementById('smsInput').value = '';
            togglePreview(false);
            currentParsedData = null;

            // Update summary
            updateMonthlySummary();

        } catch (error) {
            console.error('❌ Save error:', error);
            showError(`Failed to save: ${error.message}`);
        } finally {
            setSaveButtonLoading(false);
        }
    });

    /**
     * Clear error on input focus
     */
    document.getElementById('smsInput').addEventListener('focus', hideError);
});
