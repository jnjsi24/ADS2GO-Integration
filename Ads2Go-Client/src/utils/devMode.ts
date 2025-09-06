// Development mode utilities
export const DEV_MODE = {
  // Enable this to use placeholder components instead of heavy ones
  USE_PLACEHOLDERS: process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_PLACEHOLDERS === 'true',
  
  // Memory optimization settings
  ENABLE_MEMORY_OPTIMIZATION: true,
  
  // Lazy loading settings
  ENABLE_LAZY_LOADING: true,
  
  // Log memory usage
  LOG_MEMORY_USAGE: true
};

// Check if we should use placeholder components
export const shouldUsePlaceholder = (componentName: string): boolean => {
  if (!DEV_MODE.USE_PLACEHOLDERS) return false;
  
  // List of heavy components that can be replaced with placeholders
  const heavyComponents = [
    'CreateAdvertisement',
    'SadminDashboard', 
    'ManageAds',
    'ManageUsers',
    'PaymentHistory',
    'Advertisements',
    'Dashboard',
    'AdDetailsPage'
  ];
  
  return heavyComponents.includes(componentName);
};

// Memory usage logger
export const logMemoryUsage = (context: string) => {
  if (!DEV_MODE.LOG_MEMORY_USAGE) return;
  
  if (typeof window !== 'undefined' && (window as any).performance && (window as any).performance.memory) {
    const memory = (window as any).performance.memory;
    console.log(`🧠 Memory Usage [${context}]:`, {
      used: Math.round(memory.usedJSHeapSize / 1048576) + 'MB',
      total: Math.round(memory.totalJSHeapSize / 1048576) + 'MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1048576) + 'MB'
    });
  }
};
