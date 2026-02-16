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

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

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

    // Forward to Google Apps Script (server-to-server, no CORS issues)
    const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/d/AKfycby7Y_Kh_v-_WeaVOM0g-giBix6d-d8BsDWWbQGkGcujBB9aqjR2Sy8jMbMY6KmrUCgrDQ/usercallback';

    console.log('🔄 Forwarding to Google Apps Script...');

    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData)
    });

    const responseText = await response.text();
    console.log('📊 Google Apps Script response:', responseText);

    // Parse response
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error('❌ Failed to parse response:', responseText);
      return res.status(500).json({
        success: false,
        error: 'Invalid response from Google Apps Script',
        details: responseText
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: responseData.message || 'Failed to save transaction',
        details: responseData
      });
    }

    console.log('✅ Success:', responseData);

    return res.status(200).json({
      success: true,
      message: responseData.message || 'Transaction saved successfully',
      timestamp: new Date().toISOString(),
      data: transactionData
    });

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
