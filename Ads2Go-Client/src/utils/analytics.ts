import { analyticsService } from '../services/AnalyticsService';

// Event types for type safety
interface AnalyticsEventTypes {
  // Authentication events
  USER_SIGNED_IN: 'user_signed_in';
  USER_SIGNED_OUT: 'user_signed_out';
  USER_UPDATED: 'user_updated';
  
  // Ad events
  AD_IMPRESSION: 'ad_impression';
  AD_CLICK: 'ad_click';
  AD_VIEWED: 'ad_viewed';
  AD_COMPLETED: 'ad_completed';
  
  // User interaction events
  PAGE_VIEW: 'page_view';
  BUTTON_CLICK: 'button_click';
  FORM_SUBMIT: 'form_submit';
  
  // Navigation events
  NAVIGATION: 'navigation';
  
  // Error events
  ERROR: 'error';
  
  // Performance events
  PERFORMANCE: 'performance';
  
  // Custom events
  CUSTOM: 'custom';
  
  [key: string]: string;
}

export const AnalyticsEventType: AnalyticsEventTypes = {
  // Authentication events
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  USER_UPDATED: 'user_updated',
  
  // Ad events
  AD_IMPRESSION: 'ad_impression',
  AD_CLICK: 'ad_click',
  AD_VIEWED: 'ad_viewed',
  AD_COMPLETED: 'ad_completed',
  
  // User interaction events
  PAGE_VIEW: 'page_view',
  BUTTON_CLICK: 'button_click',
  FORM_SUBMIT: 'form_submit',
  
  // Navigation events
  NAVIGATION: 'navigation',
  
  // Error events
  ERROR: 'error',
  
  // Performance events
  PERFORMANCE: 'performance',
  
  // Custom events
  CUSTOM: 'custom',
} as const;

type AnalyticsEventType = typeof AnalyticsEventType[keyof typeof AnalyticsEventType];

interface BaseEvent {
  eventType: AnalyticsEventType;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
  pageUrl: string;
  referrer?: string;
  userAgent?: string;
  deviceInfo?: {
    type?: string;
    platform?: string;
    screenResolution?: string;
    viewportSize?: string;
  };
  customProperties?: Record<string, any>;
}

export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private sessionId: string;
  private lastPageView: string | null = null;
  private readonly VERSION = '1.0.0';

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeSession();
  }

  public static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  private generateSessionId(): string {
    return 'ses_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  private initializeSession(): void {
    // Track session start
    this.trackEvent(AnalyticsEventType.PAGE_VIEW, {
      sessionStart: true,
    });

    // Set up visibility change handler
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Session continues
          this.trackEvent(AnalyticsEventType.PAGE_VIEW, {
            sessionResume: true,
          });
        }
      });
    }
  }

  private getPageInfo() {
    if (typeof window === 'undefined') {
      return {
        url: '/',
        title: 'Unknown',
        referrer: '',
      };
    }

    return {
      url: window.location.pathname + window.location.search,
      title: document.title,
      referrer: this.lastPageView || document.referrer,
    };
  }

  private getDeviceInfo() {
    if (typeof window === 'undefined') {
      return {};
    }

    const userAgent = window.navigator.userAgent;
    let deviceType = 'desktop';
    
    if (userAgent.match(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i)) {
      deviceType = 'mobile';
    } else if (userAgent.match(/iPad|Tablet|PlayBook|Kindle|Silk|Android(?!.*Mobile)/i)) {
      deviceType = 'tablet';
    }

    return {
      type: deviceType,
      platform: window.navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      language: window.navigator.language,
    };
  }

  public async trackEvent(
    eventType: AnalyticsEventType,
    eventData: Record<string, any> = {},
    options: { immediate?: boolean } = {}
  ) {
    const { immediate = false } = options;
    const { url, title, referrer } = this.getPageInfo();
    
    const baseEvent: BaseEvent = {
      eventType,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      pageUrl: url,
      pageTitle: title,
      referrer: eventType === AnalyticsEventType.PAGE_VIEW ? referrer : this.lastPageView || referrer,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
      deviceInfo: this.getDeviceInfo(),
      customProperties: eventData,
    };

    // Update last page view for page view events
    if (eventType === AnalyticsEventType.PAGE_VIEW) {
      this.lastPageView = url;
    }

    try {
      if (immediate) {
        await analyticsService.recordEvent(eventType, baseEvent);
      } else {
        // Queue for batch processing
        analyticsService.queueEvent(eventType, baseEvent);
      }
      return { success: true };
    } catch (error) {
      console.error('Error tracking event:', error);
      return { success: false, error };
    }
  }

  // Convenience methods for common events
  public trackPageView(customData: Record<string, any> = {}) {
    return this.trackEvent(AnalyticsEventType.PAGE_VIEW, customData);
  }

  public trackButtonClick(buttonName: string, customData: Record<string, any> = {}) {
    return this.trackEvent(AnalyticsEventType.BUTTON_CLICK, {
      buttonName,
      ...customData,
    });
  }

  public trackError(error: Error, context: Record<string, any> = {}) {
    return this.trackEvent(AnalyticsEventType.ERROR, {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      ...context,
    }, { immediate: true });
  }

  // Reset the current session (e.g., on logout)
  public resetSession() {
    this.sessionId = this.generateSessionId();
    this.initializeSession();
  }
}

// Export a singleton instance
export const analytics = AnalyticsTracker.getInstance();

// Export the event type
export type AnalyticsEventType = keyof typeof AnalyticsEventType;

// Helper function to track page views with React Router
if (typeof window !== 'undefined') {
  // Track initial page view
  analytics.trackPageView();
  
  // Track subsequent page views (for SPA navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  const trackPageView = () => {
    analytics.trackPageView();
  };
  
  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args as any);
    trackPageView();
    return result;
  };
  
  history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args as any);
    trackPageView();
    return result;
  };
  
  window.addEventListener('popstate', trackPageView);
}
