import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Info, AlertTriangle } from 'lucide-react';

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
          leftBorderColor: 'border-l-green-500',
          bottomBorderColor: 'border-b-green-500',
          icon: <Check className="w-4 h-4 text-white" />,
          iconBg: 'bg-green-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-600 hover:text-gray-800'
        };
      case 'error':
        return {
          leftBorderColor: 'border-l-red-500',
          bottomBorderColor: 'border-b-red-500',
          icon: <X className="w-4 h-4 text-white" />,
          iconBg: 'bg-red-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-600 hover:text-gray-800'
        };
      case 'info':
        return {
          leftBorderColor: 'border-l-blue-500',
          bottomBorderColor: 'border-b-blue-500',
          icon: <Info className="w-4 h-4 text-white" />,
          iconBg: 'bg-blue-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-600 hover:text-gray-800'
        };
      case 'warning':
        return {
          leftBorderColor: 'border-l-orange-500',
          bottomBorderColor: 'border-b-orange-500',
          icon: <AlertTriangle className="w-4 h-4 text-white" />,
          iconBg: 'bg-orange-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-600 hover:text-gray-800'
        };
      default:
        return {
          leftBorderColor: 'border-l-gray-500',
          bottomBorderColor: 'border-b-gray-500',
          icon: <Info className="w-4 h-4 text-white" />,
          iconBg: 'bg-gray-500',
          titleColor: 'text-gray-900',
          messageColor: 'text-gray-600',
          closeColor: 'text-gray-600 hover:text-gray-800'
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
      className={`relative bg-white rounded-lg shadow-md border-l-4 ${styles.leftBorderColor} p-4 w-80 mb-3`}
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
        <div className={`flex-shrink-0 w-6 h-6 rounded-full ${styles.iconBg} flex items-center justify-center`}>
          {styles.icon}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-bold ${styles.titleColor} mb-1`}>
            {toast.title || (toast.type === 'success' ? 'Success!' : toast.type === 'error' ? 'Error!' : toast.type === 'warning' ? 'Warning' : 'Info')}
          </h4>
          <p className={`text-sm ${styles.messageColor}`}>
            {toast.message}
          </p>
        </div>
      </div>

      {/* Enhanced Progress Bar Timer */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200 rounded-b-lg overflow-hidden">
        <div 
          className={`h-full ${styles.bottomBorderColor.replace('border-b-', 'bg-')} transition-all duration-75 ease-linear`}
          style={{ width: `${progress}%` }}
        ></div>
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
