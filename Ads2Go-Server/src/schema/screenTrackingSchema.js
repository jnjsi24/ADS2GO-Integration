const gql = require('graphql-tag');

const typeDefs = gql`
  """
  Screen filters input for querying screens
  """
  input ScreenFiltersInput {
    screenType: String
    status: String
    materialId: String
  }

  """
  Location data structure
  """
  type LocationData {
    lat: Float
    lng: Float
    timestamp: String
    speed: Float
    heading: Float
    accuracy: Float
    address: String
  }

  """
  Ad performance tracking data
  """
  type AdPerformance {
    adId: String
    adTitle: String
    playCount: Int
    totalViewTime: Float
    averageViewTime: Float
    completionRate: Float
    firstPlayed: String
    lastPlayed: String
    impressions: Int
    revenue: Float
  }

  """
  Current ad information
  """
  type CurrentAd {
    adId: String
    adTitle: String
    adDuration: Int
    startTime: String
  }

  """
  Daily ad stats structure
  """
  type DailyAdStats {
    totalAdsPlayed: Int
    totalDisplayTime: Float
    uniqueAdsPlayed: Int
    averageAdDuration: Float
    adCompletionRate: Float
  }

  """
  Daily device stats structure
  """
  type DailyDeviceStats {
    date: String
    adsPlayed: Int
    displayHours: Float
    revenue: Float
  }

  """
  Screen metrics data
  """
  type ScreenMetrics {
    isDisplaying: Boolean
    brightness: Int
    volume: Int
    adPlayCount: Int
    maintenanceMode: Boolean
    currentAd: CurrentAd
    dailyAdStats: DailyAdStats
    adPerformance: [AdPerformance]
    displayHours: Float
    lastAdPlayed: String
  }

  """
  Screen data structure
  """
  type Screen {
    deviceId: String
    materialId: String
    screenType: String
    carGroupId: String
    slotNumber: Int
    isOnline: Boolean
    currentLocation: LocationData
    lastSeen: String
    currentHours: Float
    hoursRemaining: Float
    isCompliant: Boolean
    totalDistanceToday: Float
    displayStatus: String
    screenMetrics: ScreenMetrics
  }

  """
  Screens response with summary data
  """
  type ScreensResponse {
    screens: [Screen]
    totalScreens: Int
    onlineScreens: Int
    displayingScreens: Int
    maintenanceScreens: Int
  }

  """
  Ad analytics summary
  """
  type AdAnalyticsSummary {
    totalDevices: Int
    onlineDevices: Int
    totalAdsPlayed: Int
    totalDisplayHours: Float
    averageAdsPerDevice: Float
    averageDisplayHours: Float
  }

  """
  Device analytics data
  """
  type DeviceAnalytics {
    deviceId: String
    materialId: String
    screenType: String
    currentAd: String
    dailyStats: DailyAdStats
    totalAdsPlayed: Int
    displayHours: Float
    adPerformance: [AdPerformance]
    lastAdPlayed: String
    isOnline: Boolean
    lastSeen: String
  }

  """
  Ad analytics response
  """
  type AdAnalyticsResponse {
    summary: AdAnalyticsSummary
    devices: [DeviceAnalytics]
  }

  """
  Compliance report data
  """
  type ComplianceReport {
    date: String
    totalTablets: Int
    onlineTablets: Int
    compliantTablets: Int
    nonCompliantTablets: Int
    averageHours: Float
    averageDistance: Float
    screens: [Screen]
  }

  """
  Screen path data
  """
  type ScreenPath {
    deviceId: String
    date: String
    path: [String]
    totalDistance: Float
    totalHours: Float
  }

  """
  Device ad analytics
  """
  type DeviceAdAnalytics {
    deviceId: String
    date: String
    totalAdsPlayed: Int
    totalDisplayHours: Float
    adPerformance: [AdPerformance]
    dailyStats: [DailyDeviceStats]
  }

  type Query {
    """
    Get all screens with optional filtering
    """
    getAllScreens(filters: ScreenFiltersInput): ScreensResponse

    """
    Get specific screen status by device ID
    """
    getScreenStatus(deviceId: String!): Screen

    """
    Get compliance report for a specific date
    """
    getComplianceReport(date: String): ComplianceReport

    """
    Get ad analytics data
    """
    getAdAnalytics(date: String, materialId: String): AdAnalyticsResponse

    """
    Get tablets list
    """
    getTabletsList: [String]

    """
    Get ads deployments
    """
    getAdsDeployments: [String]

    """
    Get ads for specific material and slot
    """
    getAdsForMaterial(materialId: String!, slotNumber: Int!): [String]

    """
    Get screen path/history
    """
    getScreenPath(deviceId: String!, date: String): ScreenPath

    """
    Get device ad analytics
    """
    getDeviceAdAnalytics(deviceId: String!, date: String): DeviceAdAnalytics
  }

  type Mutation {
    """
    Sync all screens
    """
    syncAllScreens: String

    """
    Play all screens
    """
    playAllScreens: String

    """
    Pause all screens
    """
    pauseAllScreens: String

    """
    Stop all screens
    """
    stopAllScreens: String

    """
    Restart all screens
    """
    restartAllScreens: String

    """
    Emergency stop all screens
    """
    emergencyStopAll: String

    """
    Lockdown all screens
    """
    lockdownAllScreens: String

    """
    Unlock all screens
    """
    unlockAllScreens: String

    """
    Update screen metrics
    """
    updateScreenMetrics(deviceId: String!, metrics: String): String

    """
    Start screen session
    """
    startScreenSession(deviceId: String!): String

    """
    End screen session
    """
    endScreenSession(deviceId: String!): String

    """
    Track ad playback
    """
    trackAdPlayback(deviceId: String!, adId: String!, adTitle: String!, adDuration: Int!, viewTime: Int): String

    """
    End ad playback
    """
    endAdPlayback(deviceId: String!): String

    """
    Update driver activity
    """
    updateDriverActivity(deviceId: String!, isActive: Boolean!): String

    """
    Resolve alert
    """
    resolveAlert(deviceId: String!, alertIndex: Int!): String

    """
    Deploy ad to screens
    """
    deployAdToScreens(adId: String!, targetScreens: [String!]!, schedule: String): String

    """
    Update screen brightness
    """
    updateScreenBrightness(deviceId: String!, brightness: Int!): String

    """
    Update screen volume
    """
    updateScreenVolume(deviceId: String!, volume: Int!): String

    """
    Set maintenance mode
    """
    setMaintenanceMode(deviceId: String!, enabled: Boolean!): String

    """
    Play specific screen
    """
    playScreen(deviceId: String!): String

    """
    Pause specific screen
    """
    pauseScreen(deviceId: String!): String

    """
    Stop specific screen
    """
    stopScreen(deviceId: String!): String

    """
    Restart specific screen
    """
    restartScreen(deviceId: String!): String

    """
    Skip to next ad
    """
    skipToNextAd(deviceId: String!): String
  }
`;

module.exports = typeDefs;