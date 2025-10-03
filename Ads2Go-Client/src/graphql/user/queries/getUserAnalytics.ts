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
        totalMaterials
        totalDevices
        totalQRScans
        qrScanConversionRate
      }
      adPerformance {
        adId
        adTitle
        totalMaterials
        totalDevices
        totalAdPlayTime
        totalAdImpressions
        totalQRScans
        averageAdCompletionRate
        qrScanConversionRate
        lastUpdated
        materials {
          materialId
          materialName
          carGroupId
          totalAdPlayTime
          totalAdImpressions
          totalQRScans
          averageCompletionRate
          lastActivity
        }
      }
      dailyStats {
        date
        impressions
        adsPlayed
        displayTime
        qrScans
        completionRate
      }
      deviceStats {
        deviceId
        materialId
        impressions
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
      totalImpressions
      totalAdPlayTime
      averageAdCompletionRate
      devicePerformance {
        deviceId
        materialId
        impressions
        playTime
        completionRate
        lastUpdated
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
