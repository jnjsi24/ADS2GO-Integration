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

if (!serverUrl) {
  console.error('❌ Missing required environment variables:');
  console.error('   REACT_APP_API_URL:', serverUrl);
  console.error('   Please check your .env file');
}

const graphqlUri = process.env.REACT_APP_GRAPHQL_URL || `${serverUrl}/graphql`;

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
      // Don't log authentication errors during logout process
      if (message === 'Not authenticated' && 
          (operation.operationName === 'logout' || 
           operation.operationName === 'getOwnUserDetails' ||
           operation.operationName === 'getUserNotifications' ||
           operation.operationName === 'getUserAnalytics')) {
        console.log(`[GraphQL]: Expected auth error during ${operation.operationName} - user is logging out`);
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
