// Memory optimization utilities
export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private gcInterval: NodeJS.Timeout | null = null;
  private isOptimizing = false;

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  // Force garbage collection if available
  forceGC(): void {
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }
  }

  // Start periodic memory optimization
  startOptimization(intervalMs: number = 30000): void {
    if (this.isOptimizing) return;
    
    this.isOptimizing = true;
    this.gcInterval = setInterval(() => {
      this.optimizeMemory();
    }, intervalMs);
  }

  // Stop memory optimization
  stopOptimization(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
    this.isOptimizing = false;
  }

  // Optimize memory usage
  private optimizeMemory(): void {
    try {
      // Force garbage collection
      this.forceGC();
      
      // Clear any cached data if needed
      this.clearCaches();
      
      console.log('Memory optimization completed');
    } catch (error) {
      console.warn('Memory optimization failed:', error);
    }
  }

  // Clear various caches
  private clearCaches(): void {
    // Clear any localStorage caches if they get too large
    try {
      const keys = Object.keys(localStorage);
      if (keys.length > 100) {
        // Keep only essential keys
        const essentialKeys = ['userToken', 'adminToken', 'user', 'admin'];
        keys.forEach(key => {
          if (!essentialKeys.includes(key)) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error);
    }
  }

  // Monitor memory usage
  getMemoryInfo(): any {
    if (typeof window !== 'undefined' && (window as any).performance && (window as any).performance.memory) {
      return {
        used: Math.round((window as any).performance.memory.usedJSHeapSize / 1048576), // MB
        total: Math.round((window as any).performance.memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round((window as any).performance.memory.jsHeapSizeLimit / 1048576), // MB
      };
    }
    return null;
  }
}

// Export singleton instance
export const memoryOptimizer = MemoryOptimizer.getInstance();
