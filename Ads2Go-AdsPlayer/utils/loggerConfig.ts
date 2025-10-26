/**
 * Logger configuration for different environments
 * Import this in your main app file to configure logging
 */

import { logger, LogCategory, LogLevel } from './logger';

// Development mode - show all 3 categories with full details
export const configureDevelopmentLogging = () => {
  // Enable all 3 essential categories
  logger.enableCategory(LogCategory.AD_PLAYBACK);
  logger.enableCategory(LogCategory.AD_ANALYTICS);
  logger.enableCategory(LogCategory.DEVICE_TRACKING);
  logger.enableCategory(LogCategory.ERROR);
  logger.enableCategory(LogCategory.WARNING);
  
  logger.setMinLevel(LogLevel.INFO);
  logger.setShowTimestamps(true);
  logger.setShowCategories(true);
  logger.setCompactMode(true);
  console.log('🔧 Logger configured for DEVELOPMENT mode - All 3 categories enabled');
};

// Production mode - only show ad playback and errors
export const configureProductionLogging = () => {
  // Enable only essential categories
  logger.enableCategory(LogCategory.AD_PLAYBACK);
  logger.enableCategory(LogCategory.ERROR);
  logger.enableCategory(LogCategory.WARNING);
  
  // Disable verbose categories
  logger.disableCategory(LogCategory.AD_ANALYTICS);
  logger.disableCategory(LogCategory.DEVICE_TRACKING);
  
  logger.setMinLevel(LogLevel.INFO);
  logger.setShowTimestamps(true);
  logger.setShowCategories(true);
  logger.setCompactMode(true);
  console.log('🔧 Logger configured for PRODUCTION mode - Ad playback and errors only');
};

// Clean mode - show all 3 categories but compact
export const configureCleanLogging = () => {
  // Enable all 3 essential categories
  logger.enableCategory(LogCategory.AD_PLAYBACK);
  logger.enableCategory(LogCategory.AD_ANALYTICS);
  logger.enableCategory(LogCategory.DEVICE_TRACKING);
  logger.enableCategory(LogCategory.ERROR);
  logger.enableCategory(LogCategory.WARNING);
  
  logger.setMinLevel(LogLevel.INFO);
  logger.setShowTimestamps(true);
  logger.setShowCategories(true);
  logger.setCompactMode(true);
  console.log('🔧 Logger configured for CLEAN mode - All 3 categories, compact format');
};

// Analytics mode - focus on analytics and device tracking
export const configureAnalyticsLogging = () => {
  // Enable analytics and device tracking
  logger.enableCategory(LogCategory.AD_ANALYTICS);
  logger.enableCategory(LogCategory.DEVICE_TRACKING);
  logger.enableCategory(LogCategory.ERROR);
  logger.enableCategory(LogCategory.WARNING);
  
  // Disable real-time playback logs
  logger.disableCategory(LogCategory.AD_PLAYBACK);
  
  logger.setMinLevel(LogLevel.INFO);
  logger.setShowTimestamps(true);
  logger.setShowCategories(true);
  logger.setCompactMode(true);
  console.log('🔧 Logger configured for ANALYTICS mode - Focus on data collection');
};

// Auto-configure based on environment
export const autoConfigureLogging = () => {
  const isDevelopment = __DEV__;
  const isProduction = !isDevelopment;
  
  if (isProduction) {
    configureProductionLogging();
  } else {
    configureDevelopmentLogging();
  }
};

export default {
  configureDevelopmentLogging,
  configureProductionLogging,
  configureAnalyticsLogging,
  configureCleanLogging,
  autoConfigureLogging
};
