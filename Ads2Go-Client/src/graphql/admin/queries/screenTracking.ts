import { gql } from '@apollo/client';

// ===== SCREEN TRACKING QUERIES =====

export const GET_ALL_SCREENS = gql`
  query GetAllScreens($filters: ScreenFiltersInput) {
    getAllScreens(filters: $filters) {
      screens {
        deviceId
        materialId
        screenType
        carGroupId
        slotNumber
        isOnline
        currentLocation {
          lat
          lng
          timestamp
          speed
          heading
          accuracy
          address
        }
        lastSeen
        lastSeenDisplay
        lastSeenLocation {
          lat
          lng
          timestamp
          speed
          heading
          accuracy
          address
        }
        currentHours
        hoursRemaining
        isCompliant
        totalDistanceToday
        averageDailyHours
        complianceRate
        totalHoursOnline
        totalDistanceTraveled
        displayStatus
        alerts {
          type
          message
          timestamp
          isResolved
          severity
        }
        screenMetrics {
          isDisplaying
          brightness
          volume
          adPlayCount
          maintenanceMode
          currentAd {
            adId
            adTitle
            adDuration
            startTime
          }
          dailyAdStats {
            totalAdsPlayed
            totalDisplayTime
            uniqueAdsPlayed
            averageAdDuration
            adCompletionRate
          }
          adPerformance {
            adId
            adTitle
            playCount
            totalViewTime
            averageViewTime
            completionRate
            firstPlayed
            lastPlayed
            impressions
            revenue
          }
          displayHours
          lastAdPlayed
        }
      }
      totalScreens
      onlineScreens
      displayingScreens
      maintenanceScreens
    }
  }
`;

export const GET_SCREEN_STATUS = gql`
  query GetScreenStatus($deviceId: String!) {
    getScreenStatus(deviceId: $deviceId) {
      deviceId
      materialId
      screenType
      carGroupId
      slotNumber
      isOnline
      currentLocation {
        lat
        lng
        timestamp
        speed
        heading
        accuracy
        address
      }
      lastSeen
      lastSeenDisplay
      lastSeenLocation {
        lat
        lng
        timestamp
        speed
        heading
        accuracy
        address
      }
      currentHours
      hoursRemaining
      isCompliant
      totalDistanceToday
      averageDailyHours
      complianceRate
      totalHoursOnline
      totalDistanceTraveled
      displayStatus
      alerts {
        type
        message
        timestamp
        isResolved
        severity
      }
      screenMetrics {
        isDisplaying
        brightness
        volume
        adPlayCount
        maintenanceMode
        currentAd {
          adId
          adTitle
          adDuration
          startTime
        }
        dailyAdStats {
          totalAdsPlayed
          totalDisplayTime
          uniqueAdsPlayed
          averageAdDuration
          adCompletionRate
        }
        adPerformance {
          adId
          adTitle
          playCount
          totalViewTime
          averageViewTime
          completionRate
          firstPlayed
          lastPlayed
          impressions
          revenue
        }
        displayHours
        lastAdPlayed
      }
    }
  }
`;

export const GET_COMPLIANCE_REPORT = gql`
  query GetComplianceReport($date: String) {
    getComplianceReport(date: $date) {
      date
      totalTablets
      onlineTablets
      compliantTablets
      nonCompliantTablets
      averageHours
      averageDistance
      screens {
        deviceId
        materialId
        screenType
        carGroupId
        slotNumber
        isOnline
        currentLocation {
          lat
          lng
          timestamp
          speed
          heading
          accuracy
          address
        }
        lastSeen
        currentHours
        hoursRemaining
        totalDistanceToday
        displayStatus
        alerts {
          type
          message
          timestamp
          isResolved
          severity
        }
        screenMetrics {
          isDisplaying
          brightness
          volume
          adPlayCount
          maintenanceMode
          currentAd {
            adId
            adTitle
            adDuration
            startTime
          }
          dailyAdStats {
            totalAdsPlayed
            totalDisplayTime
            uniqueAdsPlayed
            averageAdDuration
            adCompletionRate
          }
          adPerformance {
            adId
            adTitle
            playCount
            totalViewTime
            averageViewTime
            completionRate
            firstPlayed
            lastPlayed
            impressions
            revenue
          }
          displayHours
          lastAdPlayed
        }
      }
    }
  }
`;

export const GET_AD_ANALYTICS = gql`
  query GetAdAnalytics($date: String, $materialId: String) {
    getAdAnalytics(date: $date, materialId: $materialId) {
      summary {
        totalDevices
        onlineDevices
        totalAdsPlayed
        totalDisplayHours
        averageAdsPerDevice
        averageDisplayHours
      }
      devices {
        deviceId
        materialId
        screenType
        currentAd
        dailyStats {
          totalAdsPlayed
          totalDisplayTime
          uniqueAdsPlayed
          averageAdDuration
          adCompletionRate
        }
        adPerformance {
          adId
          adTitle
          playCount
          totalViewTime
          averageViewTime
          completionRate
          firstPlayed
          lastPlayed
          impressions
          revenue
        }
        isOnline
        lastSeen
      }
    }
  }
`;

export const GET_TABLETS_LIST = gql`
  query GetTabletsList {
    getTabletsList {
      id
      deviceId
      materialId
      screenType
      status
      lastSeen
      location
      batteryLevel
      isOnline
    }
  }
`;

export const GET_ADS_DEPLOYMENTS = gql`
  query GetAdsDeployments {
    getAdsDeployments {
      id
      adId
      materialId
      slotNumber
      status
      deployedAt
      scheduledStart
      scheduledEnd
      isActive
    }
  }
`;

export const GET_ADS_FOR_MATERIAL = gql`
  query GetAdsForMaterial($materialId: String!, $slotNumber: Int!) {
    getAdsForMaterial(materialId: $materialId, slotNumber: $slotNumber) {
      id
      title
      description
      adType
      adFormat
      status
      startTime
      endTime
      mediaFile
      duration
      price
      totalPrice
      createdAt
    }
  }
`;

export const GET_SCREEN_PATH = gql`
  query GetScreenPath($deviceId: String!, $date: String) {
    getScreenPath(deviceId: $deviceId, date: $date) {
      deviceId
      date
      path {
        timestamp
        location
        coordinates {
          lat
          lng
        }
        status
        isOnline
      }
      totalDistance
      totalHours
    }
  }
`;

export const GET_DEVICE_AD_ANALYTICS = gql`
  query GetDeviceAdAnalytics($deviceId: String!, $date: String) {
    getDeviceAdAnalytics(deviceId: $deviceId, date: $date) {
      deviceId
      date
      totalAdsPlayed
      totalDisplayHours
      adPerformance {
        adId
        adTitle
        playCount
        totalViewTime
        completionRate
        revenue
      }
      dailyStats {
        date
        adsPlayed
        displayHours
        revenue
      }
    }
  }
`;