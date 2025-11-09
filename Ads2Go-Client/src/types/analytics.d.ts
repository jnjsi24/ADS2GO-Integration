declare module '../utils/analytics' {
  interface AnalyticsEventType {
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

  export const AnalyticsEventType: AnalyticsEventType;
  
  export type EventType = AnalyticsEventType[keyof AnalyticsEventType];
  
  export interface AnalyticsTracker {
    trackEvent(eventType: string, data: Record<string, any>): void;
    trackPageView(data?: Record<string, any>): void;
    trackButtonClick(buttonName: string, data?: Record<string, any>): void;
    trackError(error: Error, context?: Record<string, any>): void;
    resetSession(): void;
  }

  const analytics: AnalyticsTracker;
  export { analytics };
  export default analytics;
}
