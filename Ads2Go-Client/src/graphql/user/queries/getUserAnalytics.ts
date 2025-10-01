import { gql } from '@apollo/client';

export const GET_USER_ANALYTICS = gql`
  query GetUserAnalytics($startDate: String, $endDate: String, $period: String) {
    getUserAnalytics(startDate: $startDate, endDate: $endDate, period: $period) {
      summary {
        totalAdImpressions
        totalAdsPlayed
        totalDisplayTime
        averageCompletionRate
        totalAds
        activeAds
      }
      adPerformance {
        adId
        adTitle
        impressions
        totalPlayTime
        averageCompletionRate
        playCount
        lastPlayed
      }
      dailyStats {
        date
        impressions
        adsPlayed
        displayTime
      }
      deviceStats {
        deviceId
        materialId
        impressions
        adsPlayed
        displayTime
        lastActivity
        isOnline
      }
      period
      startDate
      endDate
    }
  }
`;

export const GET_USER_AD_DETAILS = gql`
  query GetUserAdDetails($adId: String!) {
    getUserAdDetails(adId: $adId) {
      adId
      adTitle
      adDescription
      adFormat
      status
      createdAt
      startTime
      endTime
      totalImpressions
      totalPlayTime
      averageCompletionRate
      devicePerformance {
        deviceId
        materialId
        impressions
        playTime
        completionRate
        lastPlayed
      }
      dailyPerformance {
        date
        impressions
        playTime
        completionRate
      }
    }
  }
`;
