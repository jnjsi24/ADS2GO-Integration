import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import ToastManager from '../services/toastManager';

interface ToastConfig {
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

interface NotificationToastContextType {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
  toastConfig: ToastConfig | null;
  isVisible: boolean;
}

const NotificationToastContext = createContext<NotificationToastContextType | undefined>(undefined);

export const NotificationToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showToast = (config: ToastConfig) => {
    setToastConfig(config);
    setIsVisible(true);
  };

  const hideToast = () => {
    setIsVisible(false);
    // Clear config after animation completes
    setTimeout(() => {
      setToastConfig(null);
    }, 300);
  };

  // Connect to the global toast manager
  useEffect(() => {
    const toastManager = ToastManager.getInstance();
    toastManager.setShowToast(showToast);
    console.log('🔗 NotificationToastProvider connected to ToastManager');
  }, []);

  return (
    <NotificationToastContext.Provider value={{ showToast, hideToast, toastConfig, isVisible }}>
      {children}
    </NotificationToastContext.Provider>
  );
};

export const useNotificationToast = (): NotificationToastContextType => {
  const context = useContext(NotificationToastContext);
  if (!context) {
    throw new Error('useNotificationToast must be used within a NotificationToastProvider');
  }
  return context;
};

