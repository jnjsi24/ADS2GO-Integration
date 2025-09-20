// API configuration
// Prefer a production-safe environment variable set in Expo
// Example: EXPO_PUBLIC_GRAPHQL_URL=https://ads2go-integration-production.up.railway.app/graphql
const GRAPHQL_URL =
  process.env.EXPO_PUBLIC_GRAPHQL_URL ||
  // Fallback to Railway hosting in production if not provided
  'https://ads2go-integration-production.up.railway.app/graphql';

// Derive REST base and WebSocket endpoint from the GraphQL URL
const API_BASE = GRAPHQL_URL.replace(/\/graphql$/, '');
const WS_URL = API_BASE.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws/status';

const API_CONFIG = {
  GRAPHQL_URL,
  // Backward-compatible alias used by existing screens
  API_URL: GRAPHQL_URL,
  API_BASE,
  WS_URL,
};

export default API_CONFIG;