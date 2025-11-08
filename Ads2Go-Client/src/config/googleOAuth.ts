// Google OAuth Configuration
export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
  redirectUri: `${window.location.origin}/auth/google/callback`,
  scope: 'openid profile email',
  responseType: 'code',
  accessType: 'offline',
  includeGrantedScopes: true
};

// Log OAuth configuration to help debug redirect URI issues
console.log('🔍 Google OAuth Config:', {
  clientId: GOOGLE_OAUTH_CONFIG.clientId ? 'SET' : 'MISSING',
  redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri,
  currentOrigin: window.location.origin,
  currentUrl: window.location.href
});

// Debug: Log OAuth configuration (only in verbose mode)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_OAUTH === 'true') {
  console.log('🔍 OAuth Config:', {
    clientId: GOOGLE_OAUTH_CONFIG.clientId || 'EMPTY',
    redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri,
    apiUrl: process.env.REACT_APP_API_URL || process.env.REACT_APP_SERVER_URL || 'NOT_SET',
    allEnvKeys: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
  });
}

// Google OAuth URLs
export const GOOGLE_OAUTH_URLS = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  userInfo: 'https://www.googleapis.com/oauth2/v2/userinfo'
};

// Generate Google OAuth URL
export const generateGoogleOAuthURL = (): string => {
  const redirectUri = GOOGLE_OAUTH_CONFIG.redirectUri;
  
  // Log the redirect URI being used
  console.log('🔗 Generating Google OAuth URL with redirect URI:', redirectUri);
  
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    scope: GOOGLE_OAUTH_CONFIG.scope,
    response_type: GOOGLE_OAUTH_CONFIG.responseType,
    access_type: GOOGLE_OAUTH_CONFIG.accessType,
    include_granted_scopes: GOOGLE_OAUTH_CONFIG.includeGrantedScopes.toString(),
    state: generateRandomState()
  });

  const oauthUrl = `${GOOGLE_OAUTH_URLS.auth}?${params.toString()}`;
  console.log('🔗 Full OAuth URL (first 100 chars):', oauthUrl.substring(0, 100) + '...');
  
  return oauthUrl;
};

// Generate random state for security
const generateRandomState = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Exchange authorization code for access token via server
// ✅ FIX: Use server-side endpoint to keep client secret secure
export const exchangeCodeForToken = async (code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  userInfo?: {
    id: string;
    email: string;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    verified_email: boolean;
  };
}> => {
  const apiUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_SERVER_URL || '';
  
  if (!apiUrl) {
    throw new Error('API URL not configured');
  }

  console.log('🔄 Exchanging authorization code via server...');

  const response = await fetch(`${apiUrl}/api/google-oauth/exchange-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    console.error('❌ Token exchange failed:', errorData);
    throw new Error(errorData.error || `Token exchange failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Token exchange failed');
  }

  // Return token data with userInfo if available
  return {
    ...data.token,
    userInfo: data.userInfo
  };
};

// Get user info from Google
export const getGoogleUserInfo = async (accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  verified_email: boolean;
}> => {
  const response = await fetch(GOOGLE_OAUTH_URLS.userInfo, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  return response.json();
};
