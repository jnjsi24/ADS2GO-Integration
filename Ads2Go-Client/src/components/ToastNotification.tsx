import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number;
}

interface ToastNotificationProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onRemove }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const interval = 50; // Update every 50ms
    const decrement = (100 / duration) * interval;

    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - decrement;
        if (newProgress <= 0) {
          onRemove(toast.id);
          return 0;
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast.id, toast.duration, onRemove]);

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          borderColor: 'border-l-green-500',
          icon: <CheckCircle className="w-5 h-5 text-white" />,
          iconBg: 'bg-green-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-400 hover:text-gray-600'
        };
      case 'error':
        return {
          borderColor: 'border-l-red-500',
          icon: <XCircle className="w-5 h-5 text-white" />,
          iconBg: 'bg-red-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-400 hover:text-gray-600'
        };
      case 'info':
        return {
          borderColor: 'border-l-blue-500',
          icon: <Info className="w-5 h-5 text-white" />,
          iconBg: 'bg-blue-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-400 hover:text-gray-600'
        };
      case 'warning':
        return {
          borderColor: 'border-l-orange-500',
          icon: <AlertTriangle className="w-5 h-5 text-white" />,
          iconBg: 'bg-orange-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-400 hover:text-gray-600'
        };
      default:
        return {
          borderColor: 'border-l-gray-500',
          icon: <Info className="w-5 h-5 text-white" />,
          iconBg: 'bg-gray-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-400 hover:text-gray-600'
        };
    }
  };

  const styles = getToastStyles();

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`relative bg-white rounded-lg shadow-lg border-l-4 ${styles.borderColor} p-4 w-80 mb-3`}
    >
      {/* Close Button */}
      <button
        onClick={() => onRemove(toast.id)}
        className={`absolute top-3 right-3 ${styles.closeColor} transition-colors`}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Content */}
      <div className="flex items-start space-x-3 pr-6">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          {styles.icon}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${styles.titleColor} mb-1`}>
            {toast.title || (toast.type === 'success' ? 'Success!' : toast.type === 'error' ? 'Error!' : toast.type === 'warning' ? 'Warning' : 'Info')}
          </h4>
          <p className={`text-sm ${styles.messageColor}`}>
            {toast.message}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            toast={toast}
            onRemove={onRemove}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const clearToasts = () => {
    setToasts([]);
  };

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts
  };
};

export default ToastNotification;
