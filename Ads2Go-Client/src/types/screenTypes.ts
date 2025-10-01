// Screen tracking types for admin client
export interface ScreenData {
  deviceId: string;
  materialId: string;
  screenType: string;
  carGroupId?: string;
  slotNumber: number;
  isOnline: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
    speed: number;
    heading: number;
    accuracy: number;
    address: string;
  };
  lastSeen: string;
  currentHours: number;
  hoursRemaining: number;
  isCompliant: boolean;
  totalDistanceToday: number;
  displayStatus: string;
  screenMetrics?: {
    isDisplaying: boolean;
    brightness: number;
    volume: number;
    adPlayCount: number;
    maintenanceMode: boolean;
    currentAd?: {
      adId: string;
      adTitle: string;
      adDuration: number;
      startTime: string;
      currentTime: number;
      state: string;
      progress: number;
    };
    dailyAdStats?: {
      totalAdsPlayed: number;
      totalDisplayTime: number;
      uniqueAdsPlayed: number;
      averageAdDuration: number;
      adCompletionRate: number;
    };
    adPerformance: any[];
    displayHours: number;
    lastAdPlayed: string;
  };
}

export interface AdAnalytics {
  summary: {
    totalDevices: number;
    onlineDevices: number;
    totalAdsPlayed: number;
    totalDisplayHours: number;
    averageAdsPerDevice: number;
    averageDisplayHours: number;
  };
  devices: Array<{
    deviceId: string;
    materialId: string;
    screenType: string;
    currentAd?: any;
    dailyStats?: any;
    totalAdsPlayed: number;
    displayHours: number;
    adPerformance: any[];
    lastAdPlayed: string;
    isOnline: boolean;
    lastSeen: string;
  }>;
}
