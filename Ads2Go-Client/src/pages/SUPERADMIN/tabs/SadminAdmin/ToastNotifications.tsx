import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Toast } from './types';

interface ToastNotificationsProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

const ToastNotifications: React.FC<ToastNotificationsProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-3">
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

interface ToastNotificationProps {
  toast: Toast;
  onRemove: (id: number) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onRemove }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = 5000; // 5 seconds
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
  }, [toast.id, onRemove]);

  const getToastStyles = () => {
    if (toast.type === 'success') {
      return {
        container: 'bg-white border-l-4 border-l-green-500 shadow-lg',
        icon: <Check className="w-5 h-5 text-white" />,
        iconBg: 'bg-green-500',
        title: 'text-gray-900 font-semibold',
        message: 'text-gray-600',
        closeButton: 'text-gray-400 hover:text-gray-600',
        progressBar: 'bg-green-500'
      };
    } else {
      return {
        container: 'bg-white border-l-4 border-l-red-500 shadow-lg',
        icon: <X className="w-5 h-5 text-white" />,
        iconBg: 'bg-red-500',
        title: 'text-gray-900 font-semibold',
        message: 'text-gray-600',
        closeButton: 'text-gray-400 hover:text-gray-600',
        progressBar: 'bg-red-500'
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
      className={`relative ${styles.container} rounded-lg p-4 w-80`}
    >
      {/* Close Button */}
      <button
        onClick={() => onRemove(toast.id)}
        className={`absolute top-3 right-3 ${styles.closeButton} transition-colors`}
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
          <h4 className={`text-sm ${styles.title} mb-1`}>
            {toast.type === 'success' ? 'Success!' : 'Error!'}
          </h4>
          <p className={`text-sm ${styles.message}`}>
            {toast.message}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-gray-200 rounded-full w-full">
        <div 
          className={`h-full ${styles.progressBar} rounded-full transition-all duration-50`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

export default ToastNotifications;
