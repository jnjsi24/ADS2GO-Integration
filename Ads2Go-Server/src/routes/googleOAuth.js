const express = require('express');
const router = express.Router();

/**
 * POST /api/google-oauth/exchange-token
 * Exchange Google OAuth authorization code for access token
 * This endpoint handles the token exchange server-side to keep client secret secure
 */
router.post('/exchange-token', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const defaultRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.CLIENT_URL}/auth/google/callback`;

    console.log('🔍 Google OAuth Configuration:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      redirectUri: redirectUri || defaultRedirectUri,
      clientUrl: process.env.CLIENT_URL
    });

    if (!clientId || !clientSecret) {
      console.error('❌ Google OAuth credentials not configured');
      console.error('Missing:', {
        clientId: !clientId ? 'GOOGLE_CLIENT_ID' : null,
        clientSecret: !clientSecret ? 'GOOGLE_CLIENT_SECRET' : null
      });
      return res.status(500).json({
        success: false,
        error: 'Google OAuth not configured on server. Please check server environment variables.'
      });
    }

    // Exchange code for token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri || defaultRedirectUri,
    });

    console.log('🔄 Exchanging Google OAuth code for token...');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorData);
      return res.status(tokenResponse.status).json({
        success: false,
        error: `Token exchange failed: ${tokenResponse.statusText}`,
        details: errorData
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful');

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('❌ Failed to fetch user info from Google');
      return res.status(userInfoResponse.status).json({
        success: false,
        error: `Failed to fetch user info: ${userInfoResponse.statusText}`
      });
    }

    const userInfo = await userInfoResponse.json();
    console.log('✅ User info retrieved from Google');

    // Return both token and user info
    res.json({
      success: true,
      token: tokenData,
      userInfo: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        picture: userInfo.picture,
        verified_email: userInfo.verified_email,
      }
    });

  } catch (error) {
    console.error('❌ Google OAuth token exchange error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during token exchange',
      message: error.message
    });
  }
});

module.exports = router;

