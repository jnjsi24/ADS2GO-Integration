// index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { BrowserRouter } from 'react-router-dom';
import client from './services/apolloClient';
import './index.css';
import App from './App';
// Removed AuthProvider import since App.tsx now handles auth contexts internally

const AppWrapper: React.FC = () => {
  return <App />;
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter>
        <AppWrapper />
      </BrowserRouter>
    </ApolloProvider>
  </React.StrictMode>
);
