// src/contexts/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useMutation, useApolloClient } from '@apollo/client';
import { LOGIN_MUTATION, REGISTER_MUTATION, LOGOUT_MUTATION } from '../services/graphql';
import { jwtDecode } from 'jwt-decode';

// Types
type UserRole = "ADMIN" | "USER" | "SUPERADMIN";

interface User {
  userId: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  name?: string;
  id?: string;
  address?: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
}

interface AuthContextType {
  user: User | null;
  userEmail: string;
  setUser: (user: User | null) => void;
  setUserEmail: (email: string) => void;
  login: (email: string, password: string) => Promise<User | null>;
  register: (userData: any) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  navigate: (path: string) => void;
  debugToken: (token: string) => User | null;
  navigateToRegister: () => void;
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode; navigate: (path: string) => void }> = ({
  children,
  navigate,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [registerMutation] = useMutation(REGISTER_MUTATION);
  const [logoutMutation] = useMutation(LOGOUT_MUTATION);
  const apolloClient = useApolloClient();

  const navigateToRegister = useCallback(() => {
    navigate('/register');
  }, [navigate]);

  const checkAuthentication = useCallback(() => {
    const token = localStorage.getItem('token');
    console.log('Stored Token:', token);
  
    if (token) {
      try {
        const decoded = jwtDecode<User>(token);
        console.log('Decoded Token:', decoded);
        setUser(decoded);
        setUserEmail(decoded.email);
      } catch (error) {
        console.error('Token decoding failed:', error);
        localStorage.removeItem('token');
        setUser(null);
        setUserEmail('');
      }
    } else {
      setUser(null);
      setUserEmail('');
    }
  }, []);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  // Simulated static login function
  const login = async (email: string, password: string): Promise<User | null> => {
    const mockUsers: { [key: string]: User } = {
      'admin@example.com': {
        userId: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
        isEmailVerified: true,
        name: 'Admin User',
      },
      'superadmin@example.com': {
        userId: '2',
        email: 'superadmin@example.com',
        role: 'SUPERADMIN' as UserRole,
        isEmailVerified: true,
        name: 'Super Admin',
      },
      'user@example.com': {
        userId: '3',
        email: 'user@example.com',
        role: 'USER',
        isEmailVerified: true,
        name: 'Regular User',
      },
    };

    const user = mockUsers[email.toLowerCase()];
    const validPassword = password === '123'; // simple check

    if (user && validPassword) {
      setUser(user);
      setUserEmail(user.email);
      return user;
    }

    alert('Invalid email or password');
    return null;
  };

  const register = async (userData: any): Promise<boolean> => {
    try {
      const { data } = await registerMutation({ variables: { input: userData } });

      if (data?.createUser?.token) {
        const token = data.createUser.token;
        localStorage.setItem('token', token);

        const decoded = jwtDecode<User>(token);
        setUser(decoded);
        setUserEmail(decoded.email);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutMutation();
      localStorage.removeItem('token');
      setUser(null);
      setUserEmail('');
      await apolloClient.resetStore();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const debugToken = (token: string): User | null => {
    try {
      return jwtDecode<User>(token);
    } catch (error) {
      console.error('Token decoding error:', error);
      return null;
    }
  };

  const contextValue = useMemo(
    () => ({
      user,
      userEmail,
      setUser,
      setUserEmail,
      login,
      register,
      logout,
      isAuthenticated: !!user,
      navigate,
      debugToken,
      navigateToRegister,
    }),
    [user, userEmail, navigate]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
