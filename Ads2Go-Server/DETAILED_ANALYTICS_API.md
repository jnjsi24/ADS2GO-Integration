# Detailed Analytics API Documentation

This document describes the new detailed analytics functions integrated into the Ads2Go backend system. These functions provide comprehensive analytics data for users, including ad plays, QR scans, active materials, display time, and device-specific analytics.

## Overview

The detailed analytics system provides the following key metrics:
- **Total Plays of Ads**: Track how many times ads have been played
- **Total QR Scans**: Monitor QR code interactions and conversions
- **Active Total Materials**: Get real-time status of advertising materials/devices
- **Total Display Time**: Measure engagement time with ads
- **Device-Specific Analytics**: Detailed analytics for individual devices

## API Endpoints

### 1. Get Total Ad Plays
**Endpoint**: `GET /analytics/user/:userId/total-plays`

**Description**: Retrieves the total number of ad plays for a specific user across all their active ads.

**Parameters**:
- `userId` (path): The user ID
- `startDate` (query, optional): Start date for filtering (ISO string)
- `endDate` (query, optional): End date for filtering (ISO string)

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "userId": "user123",
    "totalPlays": 1250,
    "ads": [
      {
        "adId": "ad456",
        "adTitle": "Sample Ad",
        "totalPlays": 500,
        "totalViewTime": 15000,
        "averageViewTime": 30,
        "completionRate": 85.5,
        "firstPlayed": "2024-01-01T00:00:00Z",
        "lastPlayed": "2024-01-15T12:00:00Z",
        "impressions": 500
      }
    ],
    "materials": [
      {
        "materialId": "mat789",
        "carGroupId": "CG001",
        "totalPlays": 750,
        "totalViewTime": 22500,
        "ads": []
      }
    ],
    "dateRange": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-01-15T23:59:59Z"
    },
    "summary": {
      "totalAds": 5,
      "totalMaterials": 3,
      "averagePlaysPerAd": 250
    }
  },
  "message": "Total ad plays retrieved successfully"
}
```

### 2. Get Total QR Scans
**Endpoint**: `GET /analytics/user/:userId/total-qr-scans`

**Description**: Retrieves the total number of QR scans for a specific user's ads.

**Parameters**:
- `userId` (path): The user ID
- `startDate` (query, optional): Start date for filtering (ISO string)
- `endDate` (query, optional): End date for filtering (ISO string)

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "userId": "user123",
    "totalScans": 85,
    "ads": [
      {
        "adId": "ad456",
        "adTitle": "Sample Ad",
        "totalScans": 35,
        "firstScanned": "2024-01-01T00:00:00Z",
        "lastScanned": "2024-01-15T12:00:00Z",
        "scans": [...]
      }
    ],
    "materials": [
      {
        "materialId": "mat789",
        "totalScans": 50,
        "ads": ["ad456", "ad789"]
      }
    ],
    "summary": {
      "totalAds": 5,
      "totalMaterials": 3,
      "averageScansPerAd": 17
    }
  },
  "message": "Total QR scans retrieved successfully"
}
```

### 3. Get Active Materials
**Endpoint**: `GET /analytics/user/:userId/active-materials`

**Description**: Retrieves all active materials/devices associated with a user's ads, including real-time status.

**Parameters**:
- `userId` (path): The user ID

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "userId": "user123",
    "totalMaterials": 5,
    "activeMaterials": 4,
    "materials": [
      {
        "materialId": "mat789",
        "materialName": "LCD Display for CAR",
        "materialType": "LCD",
        "vehicleType": "CAR",
        "category": "DIGITAL",
        "status": "ACTIVE",
        "driverId": "DRV001",
        "location": {
          "address": "Manila, Philippines",
          "coordinates": [120.9842, 14.5995]
        },
        "currentStatus": {
          "isOnline": true,
          "lastSeen": "2024-01-15T12:00:00Z",
          "currentLocation": {...},
          "totalAdPlays": 150,
          "totalQRScans": 25,
          "totalAdPlayTime": 4500,
          "totalAdImpressions": 150,
          "carGroupId": "CG001",
          "screenType": "LCD",
          "isDisplaying": true,
          "maintenanceMode": false
        },
        "ads": [
          {
            "adId": "ad456",
            "adTitle": "Sample Ad",
            "adType": "DIGITAL",
            "adFormat": "VIDEO",
            "status": "RUNNING",
            "adStatus": "ACTIVE",
            "durationDays": 30,
            "totalPrice": 5000
          }
        ]
      }
    ],
    "summary": {
      "totalAdPlays": 750,
      "totalQRScans": 125,
      "totalAdPlayTime": 22500,
      "onlinePercentage": 80.0,
      "averagePlaysPerMaterial": 150,
      "averageScansPerMaterial": 25
    }
  },
  "message": "Active materials retrieved successfully"
}
```

### 4. Get Total Display Time
**Endpoint**: `GET /analytics/user/:userId/total-display-time`

**Description**: Retrieves the total display time (engagement time) for a user's ads.

**Parameters**:
- `userId` (path): The user ID
- `startDate` (query, optional): Start date for filtering (ISO string)
- `endDate` (query, optional): End date for filtering (ISO string)

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "userId": "user123",
    "totalDisplayTime": 45000,
    "totalDisplayTimeHours": 12.5,
    "ads": [
      {
        "adId": "ad456",
        "adTitle": "Sample Ad",
        "totalDisplayTime": 18000,
        "totalDisplayTimeHours": 5.0,
        "totalPlays": 600,
        "averageDisplayTime": 30,
        "averageDisplayTimeHours": 0.008,
        "completionRate": 85.5,
        "firstPlayed": "2024-01-01T00:00:00Z",
        "lastPlayed": "2024-01-15T12:00:00Z",
        "impressions": 600
      }
    ],
    "materials": [
      {
        "materialId": "mat789",
        "carGroupId": "CG001",
        "totalDisplayTime": 27000,
        "totalDisplayTimeHours": 7.5,
        "totalPlays": 900,
        "ads": []
      }
    ],
    "summary": {
      "totalAds": 5,
      "totalMaterials": 3,
      "averageDisplayTimePerAd": 2.5,
      "averageDisplayTimePerMaterial": 4.17
    }
  },
  "message": "Total display time retrieved successfully"
}
```

### 5. Get Device Analytics
**Endpoint**: `GET /analytics/device/:deviceId`

**Description**: Retrieves detailed analytics for a specific device/material.

**Parameters**:
- `deviceId` (path): The device/material ID
- `startDate` (query, optional): Start date for filtering (ISO string)
- `endDate` (query, optional): End date for filtering (ISO string)

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "deviceId": "mat789",
    "material": {
      "materialId": "mat789",
      "materialName": "LCD Display for CAR",
      "materialType": "LCD",
      "vehicleType": "CAR",
      "category": "DIGITAL",
      "status": "ACTIVE",
      "driverId": "DRV001",
      "location": {...}
    },
    "currentDay": {
      "totalAdPlays": 25,
      "totalQRScans": 5,
      "totalAdPlayTime": 750,
      "totalAdImpressions": 25,
      "totalDistanceTraveled": 45.5,
      "totalHoursOnline": 8.0,
      "isOnline": true,
      "currentLocation": {...},
      "lastSeen": "2024-01-15T12:00:00Z",
      "adPerformance": [...],
      "qrScansByAd": [...],
      "currentAd": {...},
      "slots": [...],
      "networkStatus": {...},
      "complianceData": {...},
      "isDisplaying": true,
      "maintenanceMode": false
    },
    "historical": {
      "totalAdPlays": 500,
      "totalQRScans": 85,
      "totalAdPlayTime": 15000,
      "totalAdImpressions": 500,
      "totalDistanceTraveled": 1200.5,
      "totalHoursOnline": 120.0,
      "dailyData": [...],
      "adPerformance": [...],
      "qrScansByAd": [...]
    },
    "totals": {
      "totalAdPlays": 525,
      "totalQRScans": 90,
      "totalAdPlayTime": 15750,
      "totalAdPlayTimeHours": 4.375,
      "totalAdImpressions": 525,
      "totalDistanceTraveled": 1246.0,
      "totalHoursOnline": 128.0,
      "averagePlaysPerDay": 35.0,
      "averageScansPerDay": 6.0,
      "averageDisplayTimePerDay": 0.29
    },
    "ads": [...],
    "summary": {
      "isOnline": true,
      "lastSeen": "2024-01-15T12:00:00Z",
      "currentLocation": {...},
      "totalAds": 3,
      "activeAds": 2,
      "complianceStatus": "COMPLIANT",
      "displayStatus": "ACTIVE",
      "maintenanceMode": false
    }
  },
  "message": "Device analytics retrieved successfully"
}
```

### 6. Get Comprehensive Analytics
**Endpoint**: `GET /analytics/user/:userId/comprehensive`

**Description**: Retrieves a comprehensive analytics summary combining all metrics for a user.

**Parameters**:
- `userId` (path): The user ID
- `startDate` (query, optional): Start date for filtering (ISO string)
- `endDate` (query, optional): End date for filtering (ISO string)

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "userId": "user123",
    "dateRange": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-01-15T23:59:59Z"
    },
    "overview": {
      "totalAdPlays": 1250,
      "totalQRScans": 85,
      "totalDisplayTimeHours": 12.5,
      "totalMaterials": 5,
      "activeMaterials": 4,
      "totalAds": 8
    },
    "metrics": {
      "qrScanConversionRate": 6.8,
      "averageEngagementTimeHours": 0.01,
      "averagePlaysPerAd": 156.25,
      "averageScansPerAd": 10.625,
      "averageDisplayTimePerAd": 1.56,
      "onlinePercentage": 80.0
    },
    "adPlays": {...},
    "qrScans": {...},
    "materials": {...},
    "displayTime": {...}
  },
  "message": "Comprehensive analytics retrieved successfully"
}
```

## Usage Examples

### Frontend Integration

```javascript
// Get total ad plays for a user
const getTotalAdPlays = async (userId, startDate, endDate) => {
  try {
    const response = await fetch(`/api/analytics/user/${userId}/total-plays?startDate=${startDate}&endDate=${endDate}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching total ad plays:', error);
  }
};

// Get device analytics
const getDeviceAnalytics = async (deviceId, startDate, endDate) => {
  try {
    const response = await fetch(`/api/analytics/device/${deviceId}?startDate=${startDate}&endDate=${endDate}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching device analytics:', error);
  }
};

// Get comprehensive analytics
const getComprehensiveAnalytics = async (userId, startDate, endDate) => {
  try {
    const response = await fetch(`/api/analytics/user/${userId}/comprehensive?startDate=${startDate}&endDate=${endDate}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching comprehensive analytics:', error);
  }
};
```

### Backend Service Usage

```javascript
const UserAnalyticsService = require('./services/userAnalyticsService');

// Get total ad plays
const adPlaysData = await UserAnalyticsService.getTotalAdPlays('user123', startDate, endDate);

// Get QR scans
const qrScansData = await UserAnalyticsService.getTotalQRScans('user123', startDate, endDate);

// Get active materials
const materialsData = await UserAnalyticsService.getActiveTotalMaterials('user123');

// Get display time
const displayTimeData = await UserAnalyticsService.getTotalDisplayTime('user123', startDate, endDate);

// Get device analytics
const deviceData = await UserAnalyticsService.getDeviceAnalytics('device123', startDate, endDate);

// Get comprehensive analytics
const comprehensiveData = await UserAnalyticsService.getComprehensiveAnalytics('user123', startDate, endDate);
```

## Data Sources

The analytics functions pull data from multiple sources:

1. **DeviceTracking**: Real-time current day data
2. **DeviceDataHistoryV2**: Historical archived data
3. **QRScanTracking**: QR scan tracking data
4. **Material**: Material/device information
5. **Ad**: Ad information and associations

## Performance Considerations

- All functions include proper error handling and validation
- Data is aggregated efficiently using MongoDB aggregation
- Historical data is limited to reasonable date ranges (default 30 days)
- Functions use parallel processing where possible for better performance
- Results are cached in UserAnalytics collection for faster subsequent access

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

Common error scenarios:
- User not found
- No active ads for user
- Invalid date range
- Database connection issues
- Missing required parameters

## Security Considerations

- All endpoints require proper authentication
- User data is filtered to only show data belonging to the authenticated user
- Sensitive information is excluded from responses
- Input validation prevents injection attacks
- Rate limiting should be implemented at the API gateway level

## Future Enhancements

Potential improvements for the analytics system:
- Real-time WebSocket updates
- Advanced filtering and segmentation
- Export functionality (CSV, PDF)
- Custom date range presets
- Comparative analytics (period over period)
- Geographic analytics and heatmaps
- Performance benchmarking
- Automated reporting and alerts
