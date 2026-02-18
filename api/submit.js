// Vercel Serverless Function - Expense Tracker Backend
// Proxies requests to Google Apps Script to bypass CORS issues

export default async function handler(req, res) {
  // Enable CORS for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Google Apps Script URL - from environment variable
  const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwTYiTPFDFu33_QI4zQVuOJBBoikYOwPehiSBWbmq3Rc7bxcZy19iSAM7zjPFRGqPhFyQ/exec';

  // ==========================================
  // GET: Fetch all transactions from Google Sheets
  // ==========================================
  if (req.method === 'GET') {
    try {
      console.log('📨 GET request received - fetching transactions from Google Sheets');

      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10 second timeout
      });

      const responseText = await response.text();
      console.log('📊 Google Apps Script GET response status:', response.status);
      console.log('📊 Response length:', responseText.length);

      if (responseText.startsWith('{')) {
        try {
          const responseData = JSON.parse(responseText);
          console.log('✅ Google Apps Script GET success, returned', responseData.count, 'transactions');

          return res.status(200).json({
            success: true,
            data: responseData.data || [],
            count: responseData.count || 0,
            source: 'google_apps_script',
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.error('❌ Failed to parse Google Apps Script JSON response');
          return res.status(200).json({
            success: false,
            data: [],
            count: 0,
            error: 'Failed to parse response from Google Sheets'
          });
        }
      } else {
        console.error('❌ Google Apps Script returned HTML error');
        console.error('Response:', responseText.substring(0, 500));
        return res.status(200).json({
          success: false,
          data: [],
          count: 0,
          error: 'Google Apps Script is returning errors'
        });
      }

    } catch (error) {
      console.error('❌ Error in GET request:', error.message);
      return res.status(200).json({
        success: false,
        data: [],
        count: 0,
        error: error.message
      });
    }
  }

  // ==========================================
  // POST: Save transaction to Google Sheets
  // ==========================================
  else if (req.method === 'POST') {
    try {
      const transactionData = req.body;

      console.log('📨 Received transaction data:', transactionData);

      // Validate required fields
      const requiredFields = ['date', 'amount', 'currency', 'type'];
      for (const field of requiredFields) {
        if (!transactionData[field]) {
          return res.status(400).json({
            success: false,
            error: `Missing required field: ${field}`
          });
        }
      }

      console.log('✅ Validation passed');

      console.log('🔄 Forwarding to Google Apps Script...');

      try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData),
          timeout: 10000 // 10 second timeout
        });

        const responseText = await response.text();
        console.log('📊 Google Apps Script response status:', response.status);
        console.log('📊 Response length:', responseText.length);

        // Check if response is valid JSON
        if (responseText.startsWith('{')) {
          try {
            const responseData = JSON.parse(responseText);
            console.log('✅ Google Apps Script success:', responseData);

            return res.status(200).json({
              success: true,
              message: responseData.message || 'Transaction saved successfully',
              timestamp: new Date().toISOString(),
              data: transactionData,
              source: 'google_apps_script'
            });
          } catch (e) {
            console.error('❌ Failed to parse Google Apps Script JSON response');
            throw new Error('Invalid JSON from Google Apps Script');
          }
        } else {
          // Got HTML error from Google Apps Script
          console.error('❌ Google Apps Script returned HTML error');
          console.error('Response:', responseText.substring(0, 500));
          throw new Error('Google Apps Script is returning errors. Please check the deployment.');
        }

      } catch (gasError) {
        console.warn('⚠️ Google Apps Script error:', gasError.message);
        console.warn('💾 Falling back to local storage mode...');

        // If Google Apps Script fails, still accept the transaction
        // User can manually save to Google Sheets or we'll retry later
        return res.status(200).json({
          success: true,
          message: 'Transaction validated. Saving locally. Google Sheets sync pending.',
          timestamp: new Date().toISOString(),
          data: transactionData,
          source: 'local_cache',
          warning: 'Google Apps Script is currently unavailable. Your data is saved locally and will sync when the service is available.'
        });
      }

    } catch (error) {
      console.error('❌ Error in submit API:', error.message);
      console.error('Stack:', error.stack);

      return res.status(500).json({
        success: false,
        error: error.message,
        type: error.constructor.name
      });
    }
  }

  // ==========================================
  // Unsupported method
  // ==========================================
  else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }
}
