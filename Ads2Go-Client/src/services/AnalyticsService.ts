import axios from 'axios';
import { getAuthToken } from '../utils/auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class AnalyticsService {
  private client;
  private cache: Record<string, { data: any; timestamp: number }> = {};
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  // Get cached data if available and not expired
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache[key];
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    return null;
  }

  // Set data in cache
  private setCache(key: string, data: any): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
    };
  }

  // Clear specific cache entry
  public clearCache(key: string): void {
    delete this.cache[key];
  }

  // Clear all cache
  public clearAllCache(): void {
    this.cache = {};
  }

  // Get analytics for a specific material
  async getMaterialAnalytics(materialId: string, startDate: Date, endDate: Date) {
    const cacheKey = `material_${materialId}_${startDate.toISOString()}_${endDate.toISOString()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(`/analytics/material/${materialId}`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching material analytics:', error);
      throw error;
    }
  }

  // Get analytics for a specific ad
  async getAdAnalytics(adId: string, startDate: Date, endDate: Date) {
    const cacheKey = `ad_${adId}_${startDate.toISOString()}_${endDate.toISOString()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get(`/analytics/ad/${adId}`, {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching ad analytics:', error);
      throw error;
    }
  }

  // Get real-time analytics
  async getRealTimeAnalytics() {
    const cacheKey = 'realtime_analytics';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get('/analytics/realtime');
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching real-time analytics:', error);
      throw error;
    }
  }

  // Get aggregated metrics
  async getAggregatedMetrics(params: {
    metricType: string;
    timeWindow: 'hourly' | 'daily' | 'weekly' | 'monthly';
    startDate: Date;
    endDate: Date;
    dimensions?: Record<string, string>;
  }) {
    const cacheKey = `metrics_${JSON.stringify(params)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.get('/analytics/metrics', { params });
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching aggregated metrics:', error);
      throw error;
    }
  }

  // Record a new analytics event
  async recordEvent(eventType: string, data: Record<string, any>) {
    try {
      await this.client.post('/analytics/events', {
        eventType,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error recording analytics event:', error);
      // Consider implementing retry logic or offline queue here
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
