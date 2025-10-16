/**
 * Clean, categorized logging system for Ads2Go Ad Player
 * Provides organized console output with categories and filtering
 */

export enum LogCategory {
  // Real-time ad playback events
  AD_PLAYBACK = 'AD_PLAYBACK',
  
  // Historical analytics data
  AD_ANALYTICS = 'AD_ANALYTICS',
  
  // Real-time device tracking (GPS + device status)
  DEVICE_TRACKING = 'DEVICE_TRACKING',
  
  // Errors & Warnings
  ERROR = 'ERROR',
  WARNING = 'WARNING'
}

export enum LogLevel {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogConfig {
  enabledCategories: Set<LogCategory>;
  minLevel: LogLevel;
  showTimestamps: boolean;
  showCategories: boolean;
  compactMode: boolean;
}

class Logger {
  private config: LogConfig = {
    enabledCategories: new Set(Object.values(LogCategory)),
    minLevel: LogLevel.INFO,
    showTimestamps: true,
    showCategories: true,
    compactMode: false
  };

  private getTimestamp(): string {
    return new Date().toLocaleTimeString('en-US', { 
      hour12: true, 
      hour: 'numeric', 
      minute: '2-digit', 
      second: '2-digit'
    });
  }

  private formatMessage(category: LogCategory, level: LogLevel, message: string, data?: any): string {
    if (!this.config.enabledCategories.has(category) || level > this.config.minLevel) {
      return '';
    }

    const parts: string[] = [];
    
    if (this.config.showTimestamps) {
      parts.push(`[${this.getTimestamp()}]`);
    }
    
    if (this.config.showCategories) {
      const categoryIcon = this.getCategoryIcon(category);
      parts.push(`${categoryIcon} [${category}]`);
    }
    
    parts.push(message);
    
    const formattedMessage = parts.join(' ');
    
    if (data !== undefined) {
      return `${formattedMessage} ${JSON.stringify(data)}`;
    }
    
    return formattedMessage;
  }

  private getCategoryIcon(category: LogCategory): string {
    const icons: Record<LogCategory, string> = {
      [LogCategory.AD_PLAYBACK]: '🎬',
      [LogCategory.AD_ANALYTICS]: '📊',
      [LogCategory.DEVICE_TRACKING]: '📱',
      [LogCategory.ERROR]: '❌',
      [LogCategory.WARNING]: '⚠️'
    };
    return icons[category] || '📝';
  }

  private log(category: LogCategory, level: LogLevel, message: string, data?: any): void {
    const formattedMessage = this.formatMessage(category, level, message, data);
    if (!formattedMessage) return;

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARNING:
        console.warn(formattedMessage);
        break;
      case LogLevel.INFO:
        console.log(formattedMessage);
        break;
      case LogLevel.DEBUG:
        console.log(formattedMessage);
        break;
    }
  }

  // Public logging methods - Simplified 3-category system
  adPlayback(message: string, data?: any): void {
    this.log(LogCategory.AD_PLAYBACK, LogLevel.INFO, message, data);
  }

  adAnalytics(message: string, data?: any): void {
    this.log(LogCategory.AD_ANALYTICS, LogLevel.INFO, message, data);
  }

  deviceTracking(message: string, data?: any): void {
    this.log(LogCategory.DEVICE_TRACKING, LogLevel.INFO, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogCategory.ERROR, LogLevel.ERROR, message, data);
  }

  warning(message: string, data?: any): void {
    this.log(LogCategory.WARNING, LogLevel.WARNING, message, data);
  }

  // Configuration methods
  enableCategory(category: LogCategory): void {
    this.config.enabledCategories.add(category);
  }

  disableCategory(category: LogCategory): void {
    this.config.enabledCategories.delete(category);
  }

  setMinLevel(level: LogLevel): void {
    this.config.minLevel = level;
  }

  setCompactMode(enabled: boolean): void {
    this.config.compactMode = enabled;
  }

  setShowTimestamps(enabled: boolean): void {
    this.config.showTimestamps = enabled;
  }

  setShowCategories(enabled: boolean): void {
    this.config.showCategories = enabled;
  }

  // Preset configurations
  setProductionMode(): void {
    this.config.enabledCategories = new Set([
      LogCategory.SYSTEM,
      LogCategory.ERROR,
      LogCategory.WARNING,
      LogCategory.AD_PLAYBACK,
      LogCategory.AD_ANALYTICS,
      LogCategory.TRACKING
    ]);
    this.config.minLevel = LogLevel.WARNING;
    this.config.compactMode = true;
  }

  setDevelopmentMode(): void {
    this.config.enabledCategories = new Set(Object.values(LogCategory));
    this.config.minLevel = LogLevel.DEBUG;
    this.config.compactMode = false;
  }

  setMinimalMode(): void {
    this.config.enabledCategories = new Set([
      LogCategory.AD_PLAYBACK,
      LogCategory.ERROR,
      LogCategory.WARNING
    ]);
    this.config.minLevel = LogLevel.INFO;
    this.config.compactMode = true;
  }

  // Get current configuration
  getConfig(): LogConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions for the simplified 3-category system
export const log = {
  adPlayback: (message: string, data?: any) => logger.adPlayback(message, data),
  adAnalytics: (message: string, data?: any) => logger.adAnalytics(message, data),
  deviceTracking: (message: string, data?: any) => logger.deviceTracking(message, data),
  error: (message: string, data?: any) => logger.error(message, data),
  warning: (message: string, data?: any) => logger.warning(message, data)
};

export default logger;
