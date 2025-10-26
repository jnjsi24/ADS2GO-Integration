import { 
  ApolloClient, 
  InMemoryCache, 
  createHttpLink,
  ApolloLink 
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Get server configuration from environment variables
const serverUrl = process.env.REACT_APP_API_URL;

// Environment debug logging (only in verbose mode)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_APOLLO === 'true') {
  console.log('🔍 Environment Debug:', {
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    NODE_ENV: process.env.NODE_ENV,
    allEnvVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
  });
}

// Use environment variable or fallback to localhost for development
let actualServerUrl = serverUrl || 'http://localhost:5000';

// Remove trailing slash to prevent double slashes in the URL
actualServerUrl = actualServerUrl.replace(/\/$/, '');

// Apollo Client configuration logging (only in verbose mode)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_APOLLO === 'true') {
  console.log('🔧 Apollo Client Configuration:', {
    envUrl: serverUrl,
    finalUrl: actualServerUrl,
    usingFallback: !serverUrl,
    reason: serverUrl ? 'Using environment variable' : 'Using localhost fallback'
  });
}

// Remove trailing slash from actualServerUrl to prevent double slashes
const cleanServerUrl = actualServerUrl.replace(/\/$/, '');
const graphqlUri = cleanServerUrl.endsWith('/graphql') ? cleanServerUrl : cleanServerUrl + '/graphql';

const httpLink = createHttpLink({
  uri: graphqlUri,
  credentials: 'include',
  // Add timeout configuration
  fetch: (uri, options) => {
    return fetch(uri, {
      ...options,
      signal: AbortSignal.timeout(90000), // 90 second timeout (increased for analytics and notification queries)
    });
  }
});

const authLink = setContext((_, { headers }) => {
  // Check for admin token first, then user token, then generic token
  const adminToken = localStorage.getItem('adminToken');
  const userToken = localStorage.getItem('userToken');
  const token = localStorage.getItem('token');
  const finalToken = adminToken || userToken || token;
  
  // Debug logging only in development and only when token changes
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_APOLLO === 'true') {
    console.log('🔐 Apollo Client authLink:', { 
      adminToken: adminToken ? `${adminToken.substring(0, 20)}...` : null,
      userToken: userToken ? `${userToken.substring(0, 20)}...` : null,
      token: token ? `${token.substring(0, 20)}...` : null,
      finalToken: finalToken ? `${finalToken.substring(0, 20)}...` : null
    });
  }
  
  return {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      authorization: finalToken ? `Bearer ${finalToken}` : "",
    }
  }
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      // Soften logging for expected unauthenticated states (e.g., after logout)
      if (message === 'Not authenticated') {
        console.log(`[GraphQL]: Auth state missing during ${operation.operationName || 'unknown operation'} (likely after logout)`);
        return;
      }
      // Soften login credential errors (common/expected during failed login attempts)
      if (
        (message === 'Invalid password' ||
         message === 'Invalid credentials' ||
         message?.includes('temporarily locked')) &&
        (
          operation.operationName === 'loginAdmin' ||
          operation.operationName === 'LoginAdmin' ||
          operation.operationName === 'loginSuperAdmin' ||
          operation.operationName === 'LoginSuperAdmin' ||
          operation.operationName === 'loginUser' ||
          operation.operationName === 'LoginUser' ||
          operation.operationName === 'login' ||
          operation.operationName === 'Login'
        )
      ) {
        console.log(`[GraphQL]: Expected login failure for ${operation.operationName}: ${message}`);
        return;
      }
      // Soften logging for SUPERADMIN-only authorization guard
      if (message === 'Unauthorized: Only SUPERADMIN can view pricing configurations') {
        console.log('[GraphQL]: Skipping SUPERADMIN-only data for non-superadmin user');
        return;
      }
      
      // Don't log "Failed to fetch analytics data" as an error - it's expected for new users
      if (message === 'Failed to fetch analytics data' && 
          (operation.operationName === 'getUserAnalytics' || 
           operation.operationName === 'GetUserAnalytics' ||
           path?.includes('getUserAnalytics'))) {
        console.log(`[GraphQL]: No analytics data found for user - this is normal for new users`);
        return;
      }
      
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}`
      );
    });
  }
  if (networkError) {
    // Suppress timeout errors for analytics queries and notification queries - they're handled in the component
    if (networkError.message === 'signal timed out' && 
        (operation.operationName === 'getUserAnalytics' || 
         operation.operationName === 'GetUserAnalytics' ||
         operation.operationName === 'getPendingAds' ||
         operation.operationName === 'GetPendingAds' ||
         operation.operationName === 'getPendingMaterials' ||
         operation.operationName === 'GetPendingMaterials')) {
      console.log(`[GraphQL]: ${operation.operationName} query timed out - this can happen with large datasets`);
      return;
    }
    console.error(`[Network error]: ${networkError}`);
  }
});

const client = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
  // DevTools configuration
  devtools: {
    enabled: process.env.NODE_ENV === 'development',
  },
});

export default client;
