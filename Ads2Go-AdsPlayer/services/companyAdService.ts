// API Base URL - should match the one in tabletRegistration service
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.7:5000';
import { log } from '../utils/logger';
import requestManager from './requestManager';
import { AppState } from 'react-native';

export interface CompanyAd {
  id: string;
  title: string;
  description?: string;
  mediaFile: string;
  adFormat: 'VIDEO' | 'IMAGE';
  duration: number;
  isActive: boolean;
  priority: number;
  playCount: number;
  lastPlayed?: string;
  tags: string[];
  notes?: string;
  // Scheduling fields
  isScheduled: boolean;
  startDate?: string;
  endDate?: string;
  scheduleType: 'IMMEDIATE' | 'SCHEDULED';
  createdAt: string;
  updatedAt: string;
}

export interface CompanyAdResponse {
  success: boolean;
  ads: CompanyAd[];
  message?: string;
}

class CompanyAdService {
  private cache: CompanyAd[] = [];
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch active company ads from the server
   */
  async fetchActiveCompanyAds(): Promise<CompanyAdResponse> {
    try {
      log.adPlayback('Fetching active company ads...');
      
      // Use requestManager for better error handling
      const response = await requestManager.fetch(`${API_BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetActiveCompanyAds {
              getActiveCompanyAds {
                id
                title
                description
                mediaFile
                adFormat
                duration
                isActive
                priority
                playCount
                lastPlayed
                tags
                notes
                isScheduled
                startDate
                endDate
                scheduleType
                createdAt
                updatedAt
              }
            }
          `,
        }),
        timeout: 15000, // 15 second timeout for GraphQL queries
        priority: 2, // Medium priority (company ads are important)
        allowDuplicate: false, // Prevent duplicate company ad fetches
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        throw new Error(result.errors[0].message);
      }

      const ads = result.data?.getActiveCompanyAds || [];
      
      // Cache the results
      this.cache = ads;
      this.lastFetch = Date.now();
      
      console.log(`✅ Fetched ${ads.length} active company ads`);
      
      return {
        success: true,
        ads: ads,
      };
    } catch (error) {
      // If request was cancelled (AbortError), silently handle it - this is expected behavior
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('app in background') || error.message.includes('Request cancelled')) {
          // Silently handle - this is expected when app goes to background or request times out
          return {
            success: false,
            ads: [],
            message: 'Request cancelled',
          };
        }
      }
      // Only log non-cancellation errors if app is active
      if (AppState.currentState === 'active') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Network request failed') && 
            !errorMessage.includes('Request cancelled') &&
            !errorMessage.includes('app in background')) {
          console.error('❌ Error fetching company ads:', error);
        }
      }
      return {
        success: false,
        ads: [],
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a random company ad
   */
  async getRandomCompanyAd(): Promise<CompanyAd | null> {
    try {
      console.log('🎲 Fetching random company ad...');
      
      // Use requestManager for better error handling
      const response = await requestManager.fetch(`${API_BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetRandomCompanyAd {
              getRandomCompanyAd {
                id
                title
                description
                mediaFile
                adFormat
                duration
                isActive
                priority
                playCount
                lastPlayed
                tags
                notes
                createdAt
                updatedAt
              }
            }
          `,
        }),
        timeout: 15000, // 15 second timeout for GraphQL queries
        priority: 2, // Medium priority
        allowDuplicate: false,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        throw new Error(result.errors[0].message);
      }

      const ad = result.data?.getRandomCompanyAd;
      
      if (ad) {
        console.log(`✅ Fetched random company ad: ${ad.title}`);
      } else {
        console.log('⚠️ No random company ad available');
      }
      
      return ad;
    } catch (error) {
      console.error('❌ Error fetching random company ad:', error);
      return null;
    }
  }

  /**
   * Get cached company ads (if available and not expired)
   */
  getCachedCompanyAds(): CompanyAd[] {
    const now = Date.now();
    if (this.cache.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      console.log(`📦 Using cached company ads (${this.cache.length} ads)`);
      return this.cache;
    }
    return [];
  }

  /**
   * Check if an ad should be active based on scheduling
   */
  private isAdCurrentlyActive(ad: CompanyAd): boolean {
    const now = new Date();
    
    // If not scheduled, use the isActive field
    if (!ad.isScheduled || ad.scheduleType === 'IMMEDIATE') {
      return ad.isActive;
    }
    
    // For scheduled ads, check date ranges
    if (ad.scheduleType === 'SCHEDULED') {
      const startDate = ad.startDate ? new Date(ad.startDate) : null;
      const endDate = ad.endDate ? new Date(ad.endDate) : null;
      
      // If no dates set, use isActive
      if (!startDate && !endDate) {
        return ad.isActive;
      }
      
      // Check if current time is within the scheduled range
      const isAfterStart = !startDate || now >= startDate;
      const isBeforeEnd = !endDate || now <= endDate;
      
      return isAfterStart && isBeforeEnd;
    }
    
    
    return ad.isActive;
  }

  /**
   * Filter ads that are currently active based on scheduling
   */
  filterCurrentlyActiveAds(ads: CompanyAd[]): CompanyAd[] {
    return ads.filter(ad => this.isAdCurrentlyActive(ad));
  }

  /**
   * Select a weighted random company ad based on priority and scheduling
   */
  selectWeightedAd(ads: CompanyAd[]): CompanyAd | null {
    if (ads.length === 0) return null;
    
    // First filter ads that are currently active based on scheduling
    const activeAds = this.filterCurrentlyActiveAds(ads);
    
    if (activeAds.length === 0) {
      console.log('📅 No company ads are currently active based on scheduling');
      return null;
    }
    
    // Calculate weights based on priority (minimum weight of 1)
    const weights = activeAds.map(ad => Math.max(1, ad.priority));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    // Generate random number
    let random = Math.random() * totalWeight;
    
    // Select ad based on weight
    for (let i = 0; i < activeAds.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        console.log(`🎯 Selected scheduled ad "${activeAds[i].title}" with priority ${activeAds[i].priority} (weight: ${weights[i]})`);
        return activeAds[i];
      }
    }
    
    // Fallback to last ad
    return activeAds[activeAds.length - 1];
  }

  /**
   * Increment play count for a company ad
   */
  async incrementPlayCount(adId: string): Promise<boolean> {
    try {
      console.log(`📊 Incrementing play count for company ad: ${adId}`);
      
      // Use requestManager for better error handling
      const response = await requestManager.fetch(`${API_BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation IncrementCompanyAdPlayCount($id: ID!) {
              incrementCompanyAdPlayCount(id: $id) {
                id
                playCount
                lastPlayed
              }
            }
          `,
          variables: {
            id: adId,
          },
        }),
        timeout: 10000, // 10 second timeout
        priority: 1, // Lower priority (play count is not critical)
        allowDuplicate: false,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        return false;
      }

      console.log('✅ Play count incremented successfully');
      return true;
    } catch (error) {
      console.error('❌ Error incrementing play count:', error);
      return false;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = [];
    this.lastFetch = 0;
    console.log('🗑️ Company ad cache cleared');
  }
}

export default new CompanyAdService();
