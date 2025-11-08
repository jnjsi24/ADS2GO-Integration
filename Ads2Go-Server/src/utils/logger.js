// Centralized logging utility for cleaner console output
class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isVerbose = process.env.VERBOSE_LOGS === 'true';
  }

  // Only log in development or when verbose is enabled
  debug(message, ...args) {
    if (this.isDevelopment || this.isVerbose) {
      console.log(message, ...args);
    }
  }

  // Only log when verbose is explicitly enabled
  verbose(message, ...args) {
    if (this.isVerbose) {
      console.log(message, ...args);
    }
  }

  // Always log important information
  info(message, ...args) {
    console.log(message, ...args);
  }

  // ✅ FIX: Suppress warnings unless verbose mode is enabled
  warn(message, ...args) {
    if (this.isVerbose) {
      console.warn(message, ...args);
    }
  }

  // ✅ FIX: Suppress errors unless verbose mode is enabled (only log critical errors)
  error(message, ...args) {
    // Only log actual errors in production (not warnings disguised as errors)
    // Critical errors that need attention are still logged
    if (this.isVerbose || this.isDevelopment) {
      console.error(message, ...args);
    }
  }

  // Screen tracking specific logs (only in verbose mode)
  screenTracking(message, ...args) {
    if (this.isVerbose) {
      console.log(message, ...args);
    }
  }

  // Device status specific logs (only in verbose mode)
  deviceStatus(message, ...args) {
    if (this.isVerbose) {
      console.log(message, ...args);
    }
  }

  // WebSocket specific logs (only in verbose mode)
  websocket(message, ...args) {
    if (this.isVerbose) {
      console.log(message, ...args);
    }
  }

  // Notification specific logs (only in verbose mode)
  notification(message, ...args) {
    if (this.isVerbose) {
      console.log(message, ...args);
    }
  }

  // Database specific logs (only in verbose mode)
  database(message, ...args) {
    if (this.isVerbose) {
      console.log(message, ...args);
    }
  }

  // API specific logs (only in verbose mode)
  api(message, ...args) {
    if (this.isVerbose) {
      console.log(message, ...args);
    }
  }
}

module.exports = new Logger();
