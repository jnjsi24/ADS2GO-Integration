/**
 * Global Toast Manager
 * This bridges the notification service (singleton) with the React context
 */

interface ToastConfig {
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

class ToastManager {
  private static instance: ToastManager;
  private showToastFn: ((config: ToastConfig) => void) | null = null;

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  /**
   * Set the toast function from React context
   */
  setShowToast(fn: (config: ToastConfig) => void) {
    this.showToastFn = fn;
    console.log('✅ Toast manager connected to React context');
  }

  /**
   * Show a toast notification
   */
  showToast(config: ToastConfig) {
    if (this.showToastFn) {
      this.showToastFn(config);
    } else {
      console.warn('⚠️ Toast manager not initialized. Toast not shown:', config);
    }
  }
}

export default ToastManager;
export type { ToastConfig };

