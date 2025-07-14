import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import client from './services/apolloClient';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

const AppWrapper: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ApolloProvider client={client}>
      <AuthProvider navigate={navigate}>
        <App />
      </AuthProvider>
    </ApolloProvider>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppWrapper />
    </BrowserRouter>
  </React.StrictMode>
);
