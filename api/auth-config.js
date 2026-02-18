// Vercel Serverless Function - Returns authentication configuration

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // Get auth codes from environment variable (REQUIRED)
      const authCodesEnv = process.env.AUTH_CODES;
      
      if (!authCodesEnv) {
        console.error('❌ AUTH_CODES environment variable is not set');
        return res.status(500).json({
          success: false,
          error: 'Server configuration error: Missing AUTH_CODES'
        });
      }
      
      let authCodes = {};
      try {
        authCodes = JSON.parse(authCodesEnv);
      } catch (e) {
        console.error('❌ Failed to parse AUTH_CODES JSON:', e);
        return res.status(500).json({
          success: false,
          error: 'Invalid AUTH_CODES configuration'
        });
      }

      // Convert to internal format with IDs
      const result = {};
      let idCounter = 1;
      for (const [code, username] of Object.entries(authCodes)) {
        result[code] = {
          name: username,
          id: idCounter++
        };
      }

      return res.status(200).json({
        success: true,
        authCodes: result
      });
    } catch (error) {
      console.error('Error in auth-config:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load authentication configuration'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
