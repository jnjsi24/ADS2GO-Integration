import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../utils/analytics';
import { useUserAuth } from './UserAuthContext';
import { User } from 'firebase/auth';

type AnalyticsEventType = string; // Type for analytics events

interface AnalyticsContextType {
  trackEvent: (eventType: AnalyticsEventType, eventData?: Record<string, any>) => void;
  trackPageView: (customData?: Record<string, any>) => void;
  trackButtonClick: (buttonName: string, customData?: Record<string, any>) => void;
  trackError: (error: Error, context?: Record<string, any>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType>({
  trackEvent: () => {},
  trackPageView: () => {},
  trackButtonClick: () => {},
  trackError: () => {},
});

export const useAnalytics = () => useContext(AnalyticsContext);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useUserAuth();
  const user = authContext?.user as (User & { role?: string }) | null;
  const location = useLocation();

  // Track page views
  useEffect(() => {
    if (user?.uid) {
      analytics.trackEvent(AnalyticsEventType.PAGE_VIEW, {
        path: location.pathname,
        search: location.search,
        userId: user.uid,
        userRole: user.role,
      });
    } else {
      analytics.trackPageView({
        path: location.pathname,
        search: location.search
      });
    }
  }, [location.pathname, location.search, user]);

  // Track user authentication state changes
  useEffect(() => {
    if (user?.uid) {
      analytics.trackEvent('user_signed_in', {
        userId: user.uid,
        email: user.email || '',
        userRole: user.role || 'user',
      });
    }
  }, [user]);

  const trackEvent = useCallback((eventType: string, eventData: Record<string, any> = {}) => {
    const commonData = {
      ...eventData,
      ...(user?.uid && {
        userId: user.uid,
        userEmail: user.email || '',
        userRole: user.role || 'user',
      }),
    };
    
    return analytics.trackEvent(eventType, commonData);
  }, [user]);

  const trackPageView = useCallback((customData: Record<string, any> = {}) => {
    return trackEvent('page_view', {
      ...customData,
      path: window.location.pathname,
      search: window.location.search,
    });
  }, [trackEvent]);

  const trackButtonClick = useCallback((buttonName: string, customData: Record<string, any> = {}) => {
    return trackEvent('button_click', {
      buttonName,
      ...customData,
    });
  }, [trackEvent]);

  const trackError = useCallback((error: Error, context: Record<string, any> = {}) => {
    return analytics.trackError(error, {
      ...context,
      path: window.location.pathname,
      search: window.location.search,
      ...(user?.uid && {
        userId: user.uid,
        userEmail: user.email || '',
        userRole: user.role || 'user',
      }),
    });
  }, [user]);

  const value = {
    trackEvent,
    trackPageView,
    trackButtonClick,
    trackError,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
};

// Error boundary for catching React errors
export class AnalyticsErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    analytics.trackError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
  }

  render() {
    return this.props.children;
  }
}
