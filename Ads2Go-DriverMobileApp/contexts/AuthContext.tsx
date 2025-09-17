import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

type AuthState = {
  token: string | null;
  isLoading: boolean;
};

type AuthContextType = {
  state: AuthState;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    token: null,
    isLoading: true,
  });

  useEffect(() => {
    // Check if user is logged in on app start
    const loadToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        setState({
          token,
          isLoading: false,
        });
      } catch (error) {
        console.error('Failed to load token', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    loadToken();
  }, []);

  const signIn = async (token: string) => {
    try {
      await AsyncStorage.setItem('token', token);
      setState({
        token,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to sign in', error);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('token');
      setState({
        token: null,
        isLoading: false,
      });
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Failed to sign out', error);
    }
  };

  return (
    <AuthContext.Provider value={{ state, signIn, signOut }}>
      {!state.isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
