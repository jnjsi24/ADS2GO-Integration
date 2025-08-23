import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from "@apollo/client";
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';

// Create a custom link that logs all operations
const loggingLink = new ApolloLink((operation, forward) => {
  console.log('GraphQL Operation:', {
    operationName: operation.operationName,
    variables: operation.variables,
  });
  return forward(operation).map((result) => {
    console.log('GraphQL Result:', {
      operationName: operation.operationName,
      data: result.data,
      errors: result.errors,
    });
    return result;
  });
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  console.log('\n--- GraphQL Error ---');
  console.log('Operation:', operation.operationName);
  console.log('Variables:', operation.variables);
  
  if (graphQLErrors) {
    console.log('GraphQL Errors:');
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.log(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    );
  }

  if (networkError) {
    console.log(`[Network error]: ${networkError}`);
    console.log('Response:', (networkError as any)?.result);
  }
  console.log('--- End of Error ---\n');
});

const httpLink = createHttpLink({
  uri: 'http://192.168.100.22:5000/graphql', // Your PC's IP address
});

// Combine all links
const link = ApolloLink.from([
  loggingLink,
  errorLink,
  httpLink,
]);

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

// Log cache operations for debugging
client.onClearStore(() => {
  console.log('Apollo Cache Cleared');
  return Promise.resolve();
});

client.onResetStore(() => {
  console.log('Apollo Store Reset');
  return Promise.resolve();
});

export default client;
