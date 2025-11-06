/**
 * Centralized Request Manager
 * 
 * Handles:
 * - Request cancellation when app goes to background
 * - Request deduplication (prevent duplicate requests)
 * - Request throttling (limit concurrent requests)
 * - Request queuing (prevent overload)
 */

import { AppState, AppStateStatus } from 'react-native';

interface PendingRequest {
  id: string;
  controller: AbortController;
  url: string;
  timestamp: number;
}

interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  resolve: (value: Response) => void;
  reject: (error: any) => void;
  priority: number; // Higher = more important
  timestamp: number;
}

class RequestManager {
  private static instance: RequestManager;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private maxConcurrentRequests = 3; // Limit concurrent requests
  private activeRequestCount = 0;
  private appState: AppStateStatus = 'active';
  private requestCache: Map<string, { response: Response; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1000; // 1 second cache for deduplication

  private appStateSubscription: any = null;

  private constructor() {
    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    this.appState = AppState.currentState; // Initialize current state
  }

  static getInstance(): RequestManager {
    if (!RequestManager.instance) {
      RequestManager.instance = new RequestManager();
    }
    return RequestManager.instance;
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    const previousState = this.appState;
    this.appState = nextAppState;

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Cancel all pending requests when going to background
      this.cancelAllRequests();
    } else if (nextAppState === 'active' && previousState !== 'active') {
      // App came to foreground - resume queue processing
      this.processQueue();
    }
  };

  /**
   * Generate a unique request ID based on URL and options
   */
  private generateRequestId(url: string, options: RequestInit): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Check if a similar request is already pending (deduplication)
   */
  private isDuplicateRequest(requestId: string): boolean {
    // Check if request is pending
    if (this.pendingRequests.has(requestId)) {
      return true;
    }

    // Check cache for recent identical request
    const cached = this.requestCache.get(requestId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return true;
    }

    return false;
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    const requestCount = this.pendingRequests.size;
    if (requestCount > 0) {
      console.log(`🛑 [RequestManager] Cancelling ${requestCount} pending requests`);
      
      for (const [id, request] of this.pendingRequests.entries()) {
        request.controller.abort();
        this.pendingRequests.delete(id);
      }
    }
    // Don't log when there are no requests to cancel (reduces log noise)

    // Clear queue
    this.requestQueue = [];
    this.activeRequestCount = 0;
    this.isProcessingQueue = false;
  }

  /**
   * Cancel a specific request
   */
  cancelRequest(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      request.controller.abort();
      this.pendingRequests.delete(requestId);
      this.activeRequestCount--;
    }
  }

  /**
   * Process queued requests (respecting max concurrent limit)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    if (this.appState !== 'active') return; // Don't process queue in background

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequestCount < this.maxConcurrentRequests) {
      // Sort by priority (higher first) and timestamp (older first)
      this.requestQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      const queuedRequest = this.requestQueue.shift();
      if (!queuedRequest) break;

      this.activeRequestCount++;

      // Execute the request
      this.executeRequest(queuedRequest.url, queuedRequest.options, queuedRequest.id)
        .then(queuedRequest.resolve)
        .catch((error) => {
          // If app is in background and request was aborted, silently reject (don't log as error)
          if (error instanceof Error && error.name === 'AbortError' && this.appState !== 'active') {
            // Silently reject - this is expected when app goes to background
            queuedRequest.reject(new Error('Request cancelled - app in background'));
          } else {
            queuedRequest.reject(error);
          }
        })
        .finally(() => {
          this.activeRequestCount--;
          // Continue processing queue
          this.processQueue();
        });
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute a fetch request
   */
  private async executeRequest(
    url: string,
    options: RequestInit,
    requestId: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = (options as any).timeout || 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine abort signals: if options has a signal, listen to both
    let combinedSignal = controller.signal;
    if (options.signal) {
      // Create a new controller that aborts when either signal aborts
      const combinedController = new AbortController();
      const abort = () => combinedController.abort();
      controller.signal.addEventListener('abort', abort);
      options.signal.addEventListener('abort', abort);
      combinedSignal = combinedController.signal;
    }

    const pendingRequest: PendingRequest = {
      id: requestId,
      controller,
      url,
      timestamp: Date.now(),
    };

    this.pendingRequests.set(requestId, pendingRequest);

    try {
      const response = await fetch(url, {
        ...options,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);
      this.pendingRequests.delete(requestId);

      // Cache response for deduplication
      this.requestCache.set(requestId, {
        response: response.clone(),
        timestamp: Date.now(),
      });

      // Clean old cache entries
      this.cleanCache();

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      this.pendingRequests.delete(requestId);
      
      // If app is in background and request was aborted, don't throw error (it's expected)
      if (error instanceof Error && error.name === 'AbortError' && this.appState !== 'active') {
        // Return a rejected promise that won't be logged as an error
        // This is expected behavior when app goes to background
        return Promise.reject(new Error('Request cancelled - app in background'));
      }
      
      throw error;
    }
  }

  /**
   * Clean old cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL * 2) {
        this.requestCache.delete(key);
      }
    }
  }

  /**
   * Make a fetch request with cancellation, deduplication, and queuing
   */
  async fetch(
    url: string,
    options: RequestInit & { priority?: number; timeout?: number; allowDuplicate?: boolean; allowInBackground?: boolean } = {}
  ): Promise<Response> {
    const requestId = this.generateRequestId(url, options);
    const priority = options.priority || 0;
    const allowDuplicate = options.allowDuplicate || false;

    // Check for duplicates (only for non-allowed duplicates)
    // For location updates, allow duplicates since location changes frequently and we want the latest data
    const isLocationUpdate = url.includes('/location-update');
    const shouldCheckDuplicates = !allowDuplicate && !isLocationUpdate;
    
    if (shouldCheckDuplicates && this.isDuplicateRequest(requestId)) {
      // Return cached response if available and fresh
      const cached = this.requestCache.get(requestId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`⏭️ [RequestManager] Using cached response for: ${url.substring(0, 50)}...`);
        return cached.response.clone();
      }
      
      // If request is pending, wait for it to complete
      if (this.pendingRequests.has(requestId)) {
        console.log(`⏭️ [RequestManager] Waiting for pending request: ${url.substring(0, 50)}...`);
        return new Promise((resolve, reject) => {
          const checkPending = setInterval(() => {
            if (!this.pendingRequests.has(requestId)) {
              clearInterval(checkPending);
              const cached = this.requestCache.get(requestId);
              if (cached) {
                resolve(cached.response.clone());
              } else {
                // Request completed but no cache - retry with duplicate allowed
                setTimeout(() => {
                  this.fetch(url, { ...options, allowDuplicate: true }).then(resolve).catch(reject);
                }, 100);
              }
            }
          }, 50);
          
          // Timeout after 15 seconds (longer than request timeout of 10 seconds)
          setTimeout(() => {
            clearInterval(checkPending);
            reject(new Error('Duplicate request wait timeout'));
          }, 15000);
        });
      }
    }

    // Don't queue requests if app is in background (unless explicitly allowed)
    if (this.appState !== 'active' && !(options as any).allowInBackground) {
      throw new Error('App is in background - request cancelled');
    }

    // If under concurrent limit, execute immediately
    if (this.activeRequestCount < this.maxConcurrentRequests) {
      this.activeRequestCount++;
      try {
        const response = await this.executeRequest(url, options, requestId);
        this.activeRequestCount--;
        this.processQueue(); // Process queue in case it has items
        return response;
      } catch (error) {
        this.activeRequestCount--;
        this.processQueue();
        
        // If app is in background and request was aborted, return a silent rejection
        if (error instanceof Error && error.name === 'AbortError' && this.appState !== 'active') {
          throw new Error('Request cancelled - app in background');
        }
        
        throw error;
      }
    }

    // Otherwise, queue the request
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        id: requestId,
        url,
        options,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
      });

      // Start processing queue
      this.processQueue();
    });
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    pendingRequests: number;
    queuedRequests: number;
    activeRequests: number;
    appState: string;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      queuedRequests: this.requestQueue.length,
      activeRequests: this.activeRequestCount,
      appState: this.appState,
    };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.cancelAllRequests();
    this.requestCache.clear();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export default RequestManager.getInstance();

