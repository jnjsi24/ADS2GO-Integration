import { 
  ApolloClient, 
  InMemoryCache, 
  createHttpLink,
  ApolloLink 
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

const graphqlUri = process.env.REACT_APP_GRAPHQL_URL || (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL + '/graphql' : 'http://localhost:5000/graphql');

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

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
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
