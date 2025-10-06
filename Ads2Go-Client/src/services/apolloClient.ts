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

console.log('🔍 Environment Debug:', {
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  NODE_ENV: process.env.NODE_ENV,
  allEnvVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
});

// Force localhost for now to fix connection issues
const actualServerUrl = 'http://localhost:5000';

console.log('🔧 Apollo Client Configuration (FORCED LOCALHOST):', {
  envUrl: serverUrl,
  finalUrl: actualServerUrl,
  usingFallback: true,
  reason: 'Forced localhost due to connection issues'
});

const graphqlUri = 'http://localhost:5000/graphql';

const httpLink = createHttpLink({
  uri: graphqlUri,
  credentials: 'include'
});

const authLink = setContext((_, { headers }) => {
  // Check for admin token first, then user token
  const adminToken = localStorage.getItem('adminToken');
  const userToken = localStorage.getItem('userToken');
  const token = adminToken || userToken;
  
  console.log('🔐 Apollo Client authLink:', { 
    adminToken: adminToken ? `${adminToken.substring(0, 20)}...` : null,
    userToken: userToken ? `${userToken.substring(0, 20)}...` : null,
    finalToken: token ? `${token.substring(0, 20)}...` : null
  });
  
  return {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      authorization: token ? `Bearer ${token}` : "",
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
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

export default client;
