// Google OAuth Configuration
export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
  redirectUri: `${window.location.origin}/auth/google/callback`,
  scope: 'openid profile email',
  responseType: 'code',
  accessType: 'offline',
  includeGrantedScopes: true
};

// Google OAuth URLs
export const GOOGLE_OAUTH_URLS = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  userInfo: 'https://www.googleapis.com/oauth2/v2/userinfo'
};

// Generate Google OAuth URL
export const generateGoogleOAuthURL = (): string => {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
    scope: GOOGLE_OAUTH_CONFIG.scope,
    response_type: GOOGLE_OAUTH_CONFIG.responseType,
    access_type: GOOGLE_OAUTH_CONFIG.accessType,
    include_granted_scopes: GOOGLE_OAUTH_CONFIG.includeGrantedScopes.toString(),
    state: generateRandomState()
  });

  return `${GOOGLE_OAUTH_URLS.auth}?${params.toString()}`;
};

// Generate random state for security
const generateRandomState = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Exchange authorization code for access token
export const exchangeCodeForToken = async (code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}> => {
  const response = await fetch(GOOGLE_OAUTH_URLS.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  return response.json();
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
