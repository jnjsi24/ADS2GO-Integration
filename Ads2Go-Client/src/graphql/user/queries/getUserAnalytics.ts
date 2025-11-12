import { gql } from '@apollo/client';

export const GET_USER_ANALYTICS = gql`
  query GetUserAnalytics($startDate: String, $endDate: String, $period: String, $adId: String) {
    getUserAnalytics(startDate: $startDate, endDate: $endDate, period: $period, adId: $adId) {
      summary {
        totalAdsPlayed
        totalDisplayTime
        averageCompletionRate
        totalAds
        activeAds
        totalDevices
        totalQRScans
      }
      adPerformance {
        adId
        adTitle
        totalDevices
        totalAdPlayTime
        totalQRScans
        averageAdCompletionRate
        lastUpdated
        materials {
          materialId
          materialName
          carGroupId
          totalAdPlayTime
          totalQRScans
          averageCompletionRate
          lastActivity
        }
      }
      dailyStats {
        date
        adsPlayed
        displayTime
        qrScans
        completionRate
      }
      deviceStats {
        deviceId
        materialId
        adsPlayed
        displayTime
        lastActivity
        isOnline
        qrScans
      }
      period
      startDate
      endDate
      lastUpdated
      isActive
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
      totalPlayTime
      averageAdCompletionRate
      devicePerformance {
        deviceId
        materialId
        playTime
        completionRate
        lastUpdated
      }
      dailyPerformance {
        date
        playTime
        completionRate
      }
    }
  }
`;
