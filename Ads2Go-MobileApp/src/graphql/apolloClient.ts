import { ApolloClient, InMemoryCache } from "@apollo/client";

const client = new ApolloClient({
  uri: "http://192.168.100.5:5000/graphql", // 👈 use your actual local IP
  cache: new InMemoryCache(),
});

export default client;
