import { gql } from '@apollo/client';

// ===== SCREEN TRACKING MUTATIONS =====

// Bulk Operations
export const SYNC_ALL_SCREENS = gql`
  mutation SyncAllScreens {
    syncAllScreens {
      success
      message
      data
    }
  }
`;

export const PLAY_ALL_SCREENS = gql`
  mutation PlayAllScreens {
    playAllScreens {
      success
      message
      data
    }
  }
`;

export const PAUSE_ALL_SCREENS = gql`
  mutation PauseAllScreens {
    pauseAllScreens {
      success
      message
      data
    }
  }
`;

export const STOP_ALL_SCREENS = gql`
  mutation StopAllScreens {
    stopAllScreens {
      success
      message
      data
    }
  }
`;

export const RESTART_ALL_SCREENS = gql`
  mutation RestartAllScreens {
    restartAllScreens {
      success
      message
      data
    }
  }
`;

export const EMERGENCY_STOP_ALL = gql`
  mutation EmergencyStopAll {
    emergencyStopAll {
      success
      message
      data
    }
  }
`;

export const LOCKDOWN_ALL_SCREENS = gql`
  mutation LockdownAllScreens {
    lockdownAllScreens {
      success
      message
      data
    }
  }
`;

export const UNLOCK_ALL_SCREENS = gql`
  mutation UnlockAllScreens {
    unlockAllScreens {
      success
      message
      data
    }
  }
`;

// Individual Screen Operations
export const UPDATE_SCREEN_METRICS = gql`
  mutation UpdateScreenMetrics($deviceId: String!, $metrics: ScreenMetricsInput!) {
    updateScreenMetrics(deviceId: $deviceId, metrics: $metrics) {
      success
      message
      data {
        deviceId
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
          dailyAdStats
          adPerformance
          displayHours
          lastAdPlayed
        }
      }
    }
  }
`;

export const START_SCREEN_SESSION = gql`
  mutation StartScreenSession($deviceId: String!) {
    startScreenSession(deviceId: $deviceId) {
      success
      message
      data {
        deviceId
        sessionId
        startTime
        status
      }
    }
  }
`;

export const END_SCREEN_SESSION = gql`
  mutation EndScreenSession($deviceId: String!) {
    endScreenSession(deviceId: $deviceId) {
      success
      message
      data {
        deviceId
        sessionId
        endTime
        duration
        status
      }
    }
  }
`;

export const TRACK_AD_PLAYBACK = gql`
  mutation TrackAdPlayback($deviceId: String!, $adId: String!, $adTitle: String!, $adDuration: Int!, $viewTime: Int) {
    trackAdPlayback(deviceId: $deviceId, adId: $adId, adTitle: $adTitle, adDuration: $adDuration, viewTime: $viewTime) {
      success
      message
      data {
        deviceId
        adId
        adTitle
        startTime
        viewTime
        completionRate
      }
    }
  }
`;

export const END_AD_PLAYBACK = gql`
  mutation EndAdPlayback($deviceId: String!) {
    endAdPlayback(deviceId: $deviceId) {
      success
      message
      data {
        deviceId
        adId
        endTime
        totalViewTime
        completionRate
      }
    }
  }
`;

export const UPDATE_DRIVER_ACTIVITY = gql`
  mutation UpdateDriverActivity($deviceId: String!, $isActive: Boolean!) {
    updateDriverActivity(deviceId: $deviceId, isActive: $isActive) {
      success
      message
      data {
        deviceId
        isActive
        updatedAt
        status
      }
    }
  }
`;

export const RESOLVE_ALERT = gql`
  mutation ResolveAlert($deviceId: String!, $alertIndex: Int!) {
    resolveAlert(deviceId: $deviceId, alertIndex: $alertIndex) {
      success
      message
      data {
        deviceId
        alertIndex
        resolvedAt
        status
      }
    }
  }
`;

// Content Management
export const DEPLOY_AD_TO_SCREENS = gql`
  mutation DeployAdToScreens($adId: String!, $targetScreens: [String!]!, $schedule: ScheduleInput) {
    deployAdToScreens(adId: $adId, targetScreens: $targetScreens, schedule: $schedule) {
      success
      message
      data {
        deploymentId
        adId
        targetScreens
        scheduledStart
        scheduledEnd
        status
      }
    }
  }
`;

export const UPDATE_SCREEN_BRIGHTNESS = gql`
  mutation UpdateScreenBrightness($deviceId: String!, $brightness: Int!) {
    updateScreenBrightness(deviceId: $deviceId, brightness: $brightness) {
      success
      message
      data {
        deviceId
        brightness
        updatedAt
      }
    }
  }
`;

export const UPDATE_SCREEN_VOLUME = gql`
  mutation UpdateScreenVolume($deviceId: String!, $volume: Int!) {
    updateScreenVolume(deviceId: $deviceId, volume: $volume) {
      success
      message
      data {
        deviceId
        volume
        updatedAt
      }
    }
  }
`;

export const SET_MAINTENANCE_MODE = gql`
  mutation SetMaintenanceMode($deviceId: String!, $enabled: Boolean!) {
    setMaintenanceMode(deviceId: $deviceId, enabled: $enabled) {
      success
      message
      data {
        deviceId
        maintenanceMode
        updatedAt
      }
    }
  }
`;

// Screen Control Actions
export const PLAY_SCREEN = gql`
  mutation PlayScreen($deviceId: String!) {
    playScreen(deviceId: $deviceId) {
      success
      message
      data {
        deviceId
        status
        startedAt
      }
    }
  }
`;

export const PAUSE_SCREEN = gql`
  mutation PauseScreen($deviceId: String!) {
    pauseScreen(deviceId: $deviceId) {
      success
      message
      data {
        deviceId
        status
        pausedAt
      }
    }
  }
`;

export const STOP_SCREEN = gql`
  mutation StopScreen($deviceId: String!) {
    stopScreen(deviceId: $deviceId) {
      success
      message
      data {
        deviceId
        status
        stoppedAt
      }
    }
  }
`;

export const RESTART_SCREEN = gql`
  mutation RestartScreen($deviceId: String!) {
    restartScreen(deviceId: $deviceId) {
      success
      message
      data {
        deviceId
        status
        restartedAt
      }
    }
  }
`;

export const SKIP_TO_NEXT_AD = gql`
  mutation SkipToNextAd($deviceId: String!) {
    skipToNextAd(deviceId: $deviceId) {
      success
      message
      data {
        deviceId
        currentAd {
          adId
          adTitle
          adDuration
          startTime
        }
        skippedAt
      }
    }
  }
`;
