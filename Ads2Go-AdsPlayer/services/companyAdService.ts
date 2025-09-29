// API Base URL - should match the one in tabletRegistration service
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

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
      console.log('🏢 Fetching active company ads...');
      
      const response = await fetch(`${API_BASE_URL}/graphql`, {
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
                createdAt
                updatedAt
              }
            }
          `,
        }),
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
      console.error('❌ Error fetching company ads:', error);
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
      
      const response = await fetch(`${API_BASE_URL}/graphql`, {
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
   * Increment play count for a company ad
   */
  async incrementPlayCount(adId: string): Promise<boolean> {
    try {
      console.log(`📊 Incrementing play count for company ad: ${adId}`);
      
      const response = await fetch(`${API_BASE_URL}/graphql`, {
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
